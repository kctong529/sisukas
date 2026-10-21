import { expect, test, type Page } from '@playwright/test';

async function loadCatalogue(page: Page) {
  await page.goto('/');
  await expect(page.locator('#course-count')).toContainText(/Total courses:\s*[1-9]\d*/, { timeout: 45_000 });
  await expect(page.locator('.desktop-table tbody tr').first()).toBeAttached();
}

async function courseCount(page: Page): Promise<number> {
  const text = await page.locator('#course-count').innerText();
  const match = text.match(/Total courses:\s*(\d+)/);
  expect(match, `Unexpected course count: ${text}`).not.toBeNull();
  return Number(match![1]);
}

test('course code filter applies only after Search and can be removed', async ({ page }) => {
  await loadCatalogue(page);
  const originalCount = await courseCount(page);
  // Take an actual displayed course code, not a fixed value that changes with the SISU dataset.
  const existingCode = (await page.locator('.desktop-table tbody tr').first().locator('td').first().innerText()).trim();
  expect(existingCode).not.toBe('');

  await page.getByRole('button', { name: 'Add Rule' }).click();
  const rule = page.locator('.filter-rule').last();
  await expect(rule).toBeVisible();
  await rule.locator('.filter-field').selectOption('code');
  await rule.locator('.filter-relation').selectOption('equals');
  await rule.locator('input.filter-value').fill(existingCode);
  // Editing draft filter values must not immediately affect applied search results.
  expect(await courseCount(page)).toBe(originalCount);

  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect.poll(() => courseCount(page)).toBeGreaterThan(0);
  const filteredCount = await courseCount(page);
  expect(filteredCount).toBeLessThanOrEqual(originalCount);
  const codes = await page.locator('.desktop-table tbody tr td:first-child').allTextContents();
  expect(codes.length).toBeGreaterThan(0);
  expect(codes.every(value => value.trim().toLowerCase() === existingCode.toLowerCase())).toBe(true);

  await rule.getByRole('button', { name: 'Remove filter rule' }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect.poll(() => courseCount(page)).toBe(originalCount);
  await expect(page.locator('.filter-rule')).toHaveCount(0);
});

test('a non-matching filter gives an empty result and can recover', async ({ page }) => {
  await loadCatalogue(page);
  const originalCount = await courseCount(page);
  await page.getByRole('button', { name: 'Add Rule' }).click();
  const rule = page.locator('.filter-rule').first();
  await rule.locator('.filter-field').selectOption('code');
  await rule.locator('.filter-relation').selectOption('equals');
  await rule.locator('input.filter-value').fill('E2E-NONEXISTENT-COURSE-987654321');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('#course-count')).toHaveText('Total courses: 0');
  await expect(page.locator('.desktop-table tbody tr')).toHaveCount(0);

  await rule.getByRole('button', { name: 'Remove filter rule' }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect.poll(() => courseCount(page)).toBe(originalCount);
});

test('desktop course sorting reverses and page navigation preserves the table', async ({ page }) => {
  await loadCatalogue(page);
  const codeHeader = page.locator('.desktop-table thead th').filter({ hasText: 'Course Code' });
  await codeHeader.click();
  await expect(codeHeader).toHaveClass(/sort-asc/);
  const ascendingCodes = await page.locator('.desktop-table tbody tr td:first-child').allTextContents();
  expect(ascendingCodes.length).toBeGreaterThan(1);

  await codeHeader.click();
  await expect(codeHeader).toHaveClass(/sort-desc/);
  const descendingCodes = await page.locator('.desktop-table tbody tr td:first-child').allTextContents();
  expect(descendingCodes.length).toBeGreaterThan(1);
  expect(descendingCodes[0]).not.toBe(ascendingCodes[0]);

  const pages = page.locator('.pagination-controls');
  if (await pages.count()) {
    await pages.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('.pagination-info')).toContainText(/Page 2 of/);
    await pages.getByRole('button', { name: 'Previous' }).click();
    await expect(page.locator('.pagination-info')).toContainText(/Page 1 of/);
  }
});

test('course brochure links target the SISU course detail page', async ({ page }) => {
  await loadCatalogue(page);
  const link = page.locator('.desktop-table tbody tr').first().locator('td a').first();
  await expect(link).toHaveAttribute('href', /https:\/\/sisu\.aalto\.fi\/student\/courseunit\/[^/]+\/brochure/);
  await expect(link).toHaveAttribute('target', '_blank');
  // Do not navigate to the external SISU service during acceptance checks.
});
