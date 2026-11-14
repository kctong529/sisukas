import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
// Captured separately with the existing auth-state setup script. Never commit.
const secondAuthStatePath = resolve(
  process.env.SISUKAS_CALENDAR_SECOND_STORAGE_STATE ?? 'playwright/.auth/test-user-b.json',
);
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


async function activateFixturePlan(page: Page, origin: string, planId: string) {
  await apiJson(page.request, origin, `/api/plans/${planId}/activate`, 'PATCH');
  // Reload to make the Svelte plan store and Calendar projection observe the
  // server-selected plan. This is deliberately not just a UI-state assertion.
  await page.reload();
  const plans = await apiJson<Plan[]>(page.request, origin, '/api/plans', 'GET');
  expect(plans.find(plan => plan.isActive)?.id).toBe(planId);
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


// E03 uses the same offering in two separate temporary plans so that only
// plan identity can explain the different persisted visibility state.
test('E03: visibility preferences remain isolated across plans A → B → A', async ({ page }) => {
  let fixture: Awaited<ReturnType<typeof prepareFixture>> | undefined;
  const createdPlanIds: string[] = [];
  try {
    fixture = await prepareFixture(page);
    const { origin, fixtureId: planA } = fixture;
    createdPlanIds.push(planA);

    const planB = (await apiJson<Plan>(page.request, origin, '/api/plans', 'POST', {
      name: `Playwright #192 E03 B ${Date.now()}`,
    })).id;
    createdPlanIds.push(planB);

    for (const planId of [planA, planB]) {
      await apiJson(page.request, origin, `/api/plans/${planId}/instances`, 'POST', {
        instanceId: offeringId,
      });
    }

    // The same L01 group is hidden in A but inherited/visible in B.
    await activateFixturePlan(page, origin, planA);
    await setHidden(page, true);
    await reloadAndExpect(page, true);

    await activateFixturePlan(page, origin, planB);
    await expect(await openFixtureGroup(page)).toHaveAttribute('aria-pressed', 'false');
    await reloadAndExpect(page, false);

    await activateFixturePlan(page, origin, planA);
    await reloadAndExpect(page, true);

    await activateFixturePlan(page, origin, planB);
    await reloadAndExpect(page, false);
  } finally {
    if (fixture) {
      const { origin, activeId } = fixture;
      // Never delete the original plan, even if an earlier assertion failed.
      try {
        await apiJson(page.request, origin, `/api/plans/${activeId}/activate`, 'PATCH');
      } finally {
        for (const planId of [...createdPlanIds].reverse()) {
          await apiJson(page.request, origin, `/api/plans/${planId}`, 'DELETE');
        }
      }
    }
  }
});


// E05 intercepts only the temporary plan's first group PUT. The backend
// remains real for fixture setup, the retry, fresh GET hydration, and cleanup.
test('E05: failed visibility save shows an actionable error and retries successfully', async ({ page }) => {
  let fixture: Awaited<ReturnType<typeof prepareFixture>> | undefined;
  const failedPutRoute = '**/api/plans/*/calendar/groups';
  let failureInjected = false;
  try {
    fixture = await prepareFixture(page);
    const { origin, fixtureId } = fixture;
    await apiJson(page.request, origin, `/api/plans/${fixtureId}/instances`, 'POST', {
      instanceId: offeringId,
    });
    await page.reload();

    const group = await openFixtureGroup(page);
    await expect(group).toHaveAttribute('aria-pressed', 'false');

    await page.route(failedPutRoute, async route => {
      const request = route.request();
      if (!failureInjected && isGroupPut(request.url(), request.method()) &&
          new URL(request.url()).pathname === `/api/plans/${fixtureId}/calendar/groups`) {
        failureInjected = true;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Injected Calendar write failure for E05' }),
        });
      } else {
        await route.continue();
      }
    });

    const failedResponse = page.waitForResponse(response =>
      isGroupPut(response.url(), response.request().method()) &&
      new URL(response.url()).pathname === `/api/plans/${fixtureId}/calendar/groups` &&
      response.status() === 500);
    await group.click();
    await failedResponse;
    expect(failureInjected).toBe(true);

    // The UI retains the unsaved local intent and provides an explicit retry.
    await expect(group).toHaveAttribute('aria-pressed', 'true');
    const notification = page.locator('#notification-container .filter-notification.error')
      .filter({ hasText: 'Calendar visibility change(s) could not be saved' });
    await expect(notification).toBeVisible();
    const retryButton = notification.getByRole('button', { name: 'Retry', exact: true });
    await expect(retryButton).toBeVisible();

    // No request reached the backend for the failed PUT.
    const unsaved = await apiJson<{ hiddenGroups: { courseOfferingId: string;
      studyGroupId: string }[] }>(page.request, origin,
      `/api/plans/${fixtureId}/calendar`, 'GET');
    expect(unsaved.hiddenGroups).not.toContainEqual({
      courseOfferingId: offeringId, studyGroupId: groupId,
    });

    // Remove the interception before retrying: this PUT must reach staging.
    await page.unroute(failedPutRoute);
    const savedResponse = page.waitForResponse(response =>
      isGroupPut(response.url(), response.request().method()) &&
      new URL(response.url()).pathname === `/api/plans/${fixtureId}/calendar/groups` &&
      response.ok());
    await retryButton.click();
    await savedResponse;
    await expect(notification).toHaveCount(0);
    await reloadAndExpect(page, true);
  } finally {
    await page.unroute(failedPutRoute);
    if (fixture) {
      const { origin, activeId, fixtureId } = fixture;
      try {
        await apiJson(page.request, origin, `/api/plans/${activeId}/activate`, 'PATCH');
      } finally {
        await apiJson(page.request, origin, `/api/plans/${fixtureId}`, 'DELETE');
      }
    }
  }
});


// E04 exercises genuine Better Auth browser sessions, not a mocked JWT/user ID.
// Both accounts must be dedicated staging users. The test provisions matching
// offerings under independent temporary plans and cleans up each account.
test('E04: visibility preferences do not leak across authenticated accounts', async ({ page, browser }) => {
  test.skip(!existsSync(secondAuthStatePath),
    'Capture Account B with SISUKAS_STORAGE_STATE=playwright/.auth/test-user-b.json');
  if (secondAuthStatePath === authStatePath) {
    throw new Error('E04 requires two different browser state files');
  }

  const accountB = await browser.newContext({
    baseURL,
    storageState: secondAuthStatePath,
  });
  const pageB = await accountB.newPage();
  let fixtureA: Awaited<ReturnType<typeof prepareFixture>> | undefined;
  let fixtureB: Awaited<ReturnType<typeof prepareFixture>> | undefined;
  try {
    fixtureA = await prepareFixture(page);
    fixtureB = await prepareFixture(pageB);

    // Guard against accidentally capturing the same Better Auth account twice.
    // An existing active plan ID is stable and belongs to exactly one account.
    expect(fixtureA.activeId, 'Account A and B must have different plan owners')
      .not.toBe(fixtureB.activeId);
    const [plansA, plansB] = await Promise.all([
      apiJson<Plan[]>(page.request, fixtureA.origin, '/api/plans', 'GET'),
      apiJson<Plan[]>(pageB.request, fixtureB.origin, '/api/plans', 'GET'),
    ]);
    const idsA = new Set(plansA.map(plan => plan.id));
    expect(plansB.some(plan => idsA.has(plan.id)),
      'Account A and B must not share any plan IDs').toBe(false);

    for (const [targetPage, fixture] of [
      [page, fixtureA],
      [pageB, fixtureB],
    ] as const) {
      await apiJson(targetPage.request, fixture.origin,
        `/api/plans/${fixture.fixtureId}/instances`, 'POST', { instanceId: offeringId });
      await activateFixturePlan(targetPage, fixture.origin, fixture.fixtureId);
    }

    // A stores an explicit hidden preference; B has the same offering but
    // inherits visible. Reloading both forces server-side hydration.
    await setHidden(page, true);
    await reloadAndExpect(page, true);
    await reloadAndExpect(pageB, false);

    // Cross-account API reads must not expose the other account's preference.
    const foreignRead = await pageB.request.get(
      new URL(`/api/plans/${fixtureA.fixtureId}/calendar`, fixtureA.origin).toString(),
    );
    expect(foreignRead.ok(), 'Account B must not read Account A preferences').toBe(false);

    // Make a separate change under B and confirm it cannot alter A's data.
    await setHidden(pageB, true);
    await reloadAndExpect(pageB, true);
    await reloadAndExpect(page, true);

    await setHidden(pageB, false);
    await reloadAndExpect(pageB, false);
    await reloadAndExpect(page, true);
  } finally {
    // Cleanup is performed using each account's own API request context.
    // Do not delete any pre-existing plan even when assertions fail.
    try {
      if (fixtureB) {
        try {
          await apiJson(pageB.request, fixtureB.origin,
            `/api/plans/${fixtureB.activeId}/activate`, 'PATCH');
        } finally {
          await apiJson(pageB.request, fixtureB.origin,
            `/api/plans/${fixtureB.fixtureId}`, 'DELETE');
        }
      }
    } finally {
      try {
        if (fixtureA) {
          try {
            await apiJson(page.request, fixtureA.origin,
              `/api/plans/${fixtureA.activeId}/activate`, 'PATCH');
          } finally {
            await apiJson(page.request, fixtureA.origin,
              `/api/plans/${fixtureA.fixtureId}`, 'DELETE');
          }
        }
      } finally {
        await accountB.close();
      }
    }
  }
});
