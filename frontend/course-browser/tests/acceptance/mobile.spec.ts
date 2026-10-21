import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('mobile course cards and touch-accessible sorting work', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#course-count')).toContainText(/Total courses:\s*[1-9]\d*/, { timeout: 45_000 });
  await expect(page.locator('.desktop-table-wrapper')).toBeHidden();
  const cards = page.locator('.mobile-cards .course-card');
  await expect(cards.first()).toBeVisible();

  const sort = page.locator('#mobile-sort');
  await expect(sort).toBeVisible();
  await sort.selectOption('courseCode');
  await expect(sort).toHaveValue('courseCode');
  const direction = page.getByRole('button', { name: 'Toggle sort direction' });
  const oldDirection = (await direction.innerText()).trim();
  await direction.tap();
  await expect(direction).not.toHaveText(oldDirection);
  await expect(cards.first()).toBeVisible();
});

test('mobile search rule and source switching remain usable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#course-count')).toContainText(/Total courses:\s*[1-9]\d*/, { timeout: 45_000 });
  await page.getByRole('button', { name: 'Add Rule' }).tap();
  const rule = page.locator('.filter-rule').first();
  await expect(rule).toBeVisible();
  await rule.locator('.filter-field').selectOption('code');
  await rule.locator('.filter-relation').selectOption('equals');
  await rule.locator('input.filter-value').fill('E2E-NONEXISTENT-COURSE-987654321');
  await page.getByRole('button', { name: 'Search', exact: true }).tap();
  await expect(page.locator('#course-count')).toHaveText('Total courses: 0');
  await rule.getByRole('button', { name: 'Remove filter rule' }).tap();
  await page.getByRole('button', { name: 'Search', exact: true }).tap();
  await expect(page.locator('.mobile-cards .course-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'See Older' }).tap();
  await expect(page.getByRole('button', { name: 'See Active' })).toBeVisible();
});
