import { expect, test, type Locator, type Page } from '@playwright/test';

// Every currently registered filter blueprint in src/domain/filters/blueprints/index.ts.
// These are UI/integration checks against the deployed catalogue, not isolated domain-rule tests.
const RULES = [
  { key: 'code', kind: 'text', relation: 'equals' },
  { key: 'name', kind: 'text', relation: 'contains' },
  { key: 'period', kind: 'period', relation: 'overlaps' },
  { key: 'startDate', kind: 'date', relation: 'onOrAfter' },
  { key: 'endDate', kind: 'date', relation: 'onOrBefore' },
  { key: 'major', kind: 'membership', relation: 'isMemberOf' },
  { key: 'master', kind: 'membership', relation: 'isMemberOf' },
  { key: 'minor', kind: 'membership', relation: 'isMemberOf' },
  { key: 'enrollment', kind: 'date', relation: 'containsDate' },
  { key: 'organization', kind: 'select', relation: 'equals' },
  { key: 'teachers', kind: 'text', relation: 'includes' },
  { key: 'language', kind: 'select', relation: 'includes' },
  { key: 'format', kind: 'select', relation: 'equals' },
  { key: 'credits', kind: 'number', relation: 'minEquals' },
  { key: 'level', kind: 'select', relation: 'equals' },
  { key: 'tags', kind: 'text', relation: 'includes' },
] as const;

async function load(page: Page): Promise<number> {
  await page.goto('/');
  await expect(page.locator('#course-count')).toContainText(/Total courses:\s*[1-9]\d*/, { timeout: 45_000 });
  return count(page);
}

async function count(page: Page): Promise<number> {
  const text = await page.locator('#course-count').innerText();
  const match = text.match(/Total courses:\s*(\d+)/);
  expect(match, `Unexpected course count: ${text}`).not.toBeNull();
  return Number(match![1]);
}

async function addRule(page: Page, key: string): Promise<Locator> {
  await page.getByRole('button', { name: 'Add Rule' }).click();
  const rule = page.locator('.filter-rule').last();
  await expect(rule).toBeVisible();
  await rule.locator('.filter-field').selectOption(key);
  await expect(rule.locator('.filter-field')).toHaveValue(key);
  return rule;
}

async function fillValue(page: Page, rule: Locator, key: string, kind: string): Promise<void> {
  const value = rule.locator('.filter-value');
  switch (kind) {
    case 'text': {
      const code = (await page.locator('.desktop-table tbody tr').first().locator('td').first().innerText()).trim();
      await value.fill(key === 'code' ? code : 'E2E-UNLIKELY-SEARCH-TOKEN-314159');
      break;
    }
    case 'date':
      await value.fill('2026-10-21');
      break;
    case 'number':
      await value.fill('5');
      break;
    case 'select':
    case 'membership': {
      await expect(value).toBeVisible();
      const options = value.locator('option');
      const n = await options.count();
      // A missing option is an actionable failure: it may indicate broken metadata loading.
      expect(n, `${key} should have at least one available choice`).toBeGreaterThan(0);
      const option = await options.first().getAttribute('value');
      expect(option, `${key} first choice lacks a value`).toBeTruthy();
      await value.selectOption(option!);
      break;
    }
    case 'period': {
      await value.click();
      const period = page.locator('.periods-container .period').first();
      await expect(period).toBeVisible();
      await period.focus();
      await period.press('Enter');
      await expect(value).not.toHaveValue('');
      break;
    }
    default:
      throw new Error(`Unhandled filter input type ${kind}`);
  }
}

for (const { key, kind, relation } of RULES) {
  test(`filter field ${key}: configure, apply, remove, and restore catalogue`, async ({ page }) => {
    const original = await load(page);
    const rule = await addRule(page, key);
    const relationInput = rule.locator('.filter-relation');
    await relationInput.selectOption(relation);
    await expect(relationInput).toHaveValue(relation);
    await fillValue(page, rule, key, kind);

    // Editing a draft rule does not update the previously applied result set.
    expect(await count(page)).toBe(original);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    if (key === 'code') {
      await expect.poll(() => count(page)).toBeGreaterThan(0);
      const codes = await page.locator('.desktop-table tbody tr td:first-child').allTextContents();
      const expected = (await rule.locator('input.filter-value').inputValue()).toLowerCase();
      expect(codes.length).toBeGreaterThan(0);
      expect(codes.every(code => code.trim().toLowerCase() === expected)).toBe(true);
    } else if (key === 'name' || key === 'teachers' || key === 'tags') {
      await expect(page.locator('#course-count')).toHaveText('Total courses: 0');
    } else {
      // Other fields are driven by live metadata; semantic assertions belong in deterministic fixture tests.
      await expect(page.locator('#course-count')).toContainText(/Total courses:\s*\d+/);
      expect(await count(page)).toBeLessThanOrEqual(original);
    }

    // Remove and re-apply; no permanent course or account data was changed.
    await rule.getByRole('button', { name: 'Remove filter rule' }).click();
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect.poll(() => count(page)).toBe(original);
    await expect(page.locator('.filter-rule')).toHaveCount(0);
  });
}

test('two rules offer AND and OR operators and apply only after Search', async ({ page }) => {
  const original = await load(page);
  const first = await addRule(page, 'code');
  await first.locator('.filter-relation').selectOption('equals');
  await first.locator('input.filter-value').fill('E2E-NO-CODE-314159');
  const second = await addRule(page, 'name');
  await second.locator('.filter-relation').selectOption('contains');
  await second.locator('input.filter-value').fill('E2E-NO-NAME-271828');
  const boolean = second.locator('.filter-boolean');
  await expect(boolean).toBeVisible();
  await boolean.selectOption('AND');
  expect(await count(page)).toBe(original);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('#course-count')).toHaveText('Total courses: 0');
  await boolean.selectOption('OR');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('#course-count')).toHaveText('Total courses: 0');
  await first.getByRole('button', { name: 'Remove filter rule' }).click();
  await second.getByRole('button', { name: 'Remove filter rule' }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect.poll(() => count(page)).toBe(original);
});
