import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  anonymousStorageState,
  authStatePath,
  expectSignedIn,
  hasAuthState,
  navigation,
} from './fixtures/auth';

// This is a real persistence test. It creates/deletes a temporary plan on Test.
const enabled = process.env.SISUKAS_CALENDAR_WRITE_TEST === 'yes';
const baseURL = process.env.SISUKAS_BASE_URL ?? 'https://test.sisukas.eu';
// The study-group response uses unitId:offeringId; plans store only offeringId.
const offeringId = 'aalto-cur-P-c235f107-0fd6-11f1-8c99-0050569455c9';
// Source group identity (for fixture provenance):
const groupId = 'aalto-ssg-4520-217660-1-01';
const groupName = 'L01';
const groupType = 'Lecture';
const weekStart = '2026-11-16'; // Contains the source event on 17 November.

if (enabled) {
  if (new URL(baseURL).origin !== 'https://test.sisukas.eu') {
    throw new Error('Calendar write tests require https://test.sisukas.eu');
  }
  if (!hasAuthState) {
    throw new Error('Capture a test-account authenticated state first');
  }
}

test.skip(!enabled, 'Opt in with SISUKAS_CALENDAR_WRITE_TEST=yes');
// Allow time for staging requests and reliable cleanup, but fail fast on missing UI controls.
test.setTimeout(120_000);
test.use({
  baseURL,
  storageState: hasAuthState ? authStatePath : anonymousStorageState,
});

type Plan = { id: string; isActive: boolean; instanceIds: string[] };

function isPlansGet(url: string, method: string) {
  return method === 'GET' && /\/api\/plans\/?(?:\?.*)?$/.test(url);
}
function isPreferencesGet(url: string, method: string) {
  return method === 'GET' && /\/api\/plans\/[^/]+\/calendar(?:\?.*)?$/.test(url);
}
function isGroupPut(url: string, method: string) {
  return method === 'PUT' && /\/api\/plans\/[^/]+\/calendar\/groups(?:\?.*)?$/.test(url);
}

async function apiJson<T>(request: APIRequestContext, origin: string, path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const response = await request.fetch(new URL(path, origin).toString(), {
    method,
    ...(body === undefined ? {} : { data: body }),
  });
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
  if (response.status() === 204) return undefined as T;
  return await response.json() as T;
}

async function prepareFixture(page: Page) {
  // Discover the authenticated backend origin from the application's own GET.
  const plansResponse = page.waitForResponse(response =>
    isPlansGet(response.url(), response.request().method()) && response.ok());
  await expectSignedIn(page);
  const plans = await plansResponse;
  const origin = new URL(plans.url()).origin;
  const prior = await apiJson<Plan[]>(page.request, origin, '/api/plans', 'GET');
  const activeId = prior.find(plan => plan.isActive)?.id;
  if (!activeId) throw new Error('Expected the test account to have an active plan');

  const fixture = await apiJson<Plan>(page.request, origin, '/api/plans', 'POST', {
    name: `Playwright #192 E01-E02 ${Date.now()}`,
  });
  return { origin, activeId, fixtureId: fixture.id };
}

async function openFixtureGroup(page: Page) {
  // Desktop navigation has aria-label='Weekly calendar'; accessible name is not 'Calendar'.
  await navigation(page).getByRole('button', { name: 'Weekly calendar' }).click({ timeout: 10_000 });
  const calendar = page.locator('.calendar-view');
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText('Unable to load Calendar visibility preferences:', { exact: false })).toHaveCount(0);

  // Calendar opens on the current Helsinki week, not necessarily the fixture week.
  const next = page.getByRole('navigation', { name: 'Calendar week navigation' })
    .getByRole('button', { name: 'Next week' });
  const range = page.locator('.week-range .dates');
  const targetStart = new Date(`${weekStart}T00:00:00Z`).getTime();
  for (let step = 0; step < 80; step++) {
    const text = await range.innerText();
    const match = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!match) throw new Error(`Unexpected Calendar week range: ${text}`);
    const displayed = Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    if (displayed === targetStart) break;
    if (displayed > targetStart) {
      const previous = page.getByRole('navigation', { name: 'Calendar week navigation' })
        .getByRole('button', { name: 'Previous week' });
      await previous.click();
    } else {
      await next.click();
    }
    if (step === 79) throw new Error('Unable to navigate to fixture week');
  }

  // The temporary plan has exactly one offering; no fragile course-code lookup.
  const courses = page.getByRole('navigation', { name: 'Courses active this week' });
  await expect(courses.getByRole('button')).toHaveCount(1, { timeout: 30_000 });
  await courses.getByRole('button').click();
  const panel = calendar.locator('.course-context');
  const group = panel.getByRole('button', {
    name: new RegExp(`^${groupName}, ${groupType}, (hidden|visible)\\.`),
  });
  await expect(group).toHaveCount(1);
  // The source JSON identifies this group unambiguously within the fixture offering.
  expect(groupId).toBe('aalto-ssg-4520-217660-1-01');
  return group;
}

async function setHidden(page: Page, hidden: boolean) {
  const group = await openFixtureGroup(page);
  if (await group.getAttribute('aria-pressed') === String(hidden)) return;
  const put = page.waitForResponse(response =>
    isGroupPut(response.url(), response.request().method()));
  await group.click();
  const response = await put;
  expect(response.ok(), `Calendar group PUT failed: ${response.status()}`).toBeTruthy();
  await expect(group).toHaveAttribute('aria-pressed', String(hidden));
}

async function reloadAndExpect(page: Page, hidden: boolean) {
  const get = page.waitForResponse(response =>
    isPreferencesGet(response.url(), response.request().method()));
  await page.reload();
  expect((await get).ok()).toBeTruthy();
  await expect(await openFixtureGroup(page)).toHaveAttribute('aria-pressed', String(hidden));
}

test('E01–E02: teaching-group hide and restore survive server hydration', async ({ page }) => {
  let fixture: Awaited<ReturnType<typeof prepareFixture>> | undefined;
  try {
    fixture = await prepareFixture(page);
    const { origin, fixtureId } = fixture;
    await apiJson(page.request, origin, `/api/plans/${fixtureId}/instances`, 'POST', {
      instanceId: offeringId,
    });
    await page.reload();
    await setHidden(page, true);
    await reloadAndExpect(page, true);  // E01
    await setHidden(page, false);
    await reloadAndExpect(page, false); // E02
  } finally {
    if (fixture) {
      const { origin, fixtureId, activeId } = fixture;
      // Cleanup should run even if a UI assertion fails.
      try {
        await apiJson(page.request, origin, `/api/plans/${activeId}/activate`, 'PATCH');
      } finally {
        await apiJson(page.request, origin, `/api/plans/${fixtureId}`, 'DELETE');
      }
    }
  }
});
