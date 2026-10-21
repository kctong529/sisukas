import { expect, test } from '@playwright/test';

const nav = (page: import('@playwright/test').Page) => page.locator('nav.navbar');

async function openCourses(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(nav(page).getByRole('button', { name: 'Browse courses' })).toBeVisible();
  await expect(page.locator('#course-count')).toContainText(/Total courses:\s*[1-9]\d*/, { timeout: 45_000 });
  await expect(page.locator('.desktop-table tbody tr').first()).toBeAttached();
}

test('guest: course dataset and YAML-powered search UI load', async ({ page }) => {
  const fatalErrors: string[] = [];
  page.on('pageerror', error => fatalErrors.push(error.message));
  await openCourses(page);
  await expect(page.locator('.desktop-table thead')).toContainText('Course Code');
  await expect(page.locator('.desktop-table tbody tr').first()).toContainText(/\S/);
  await expect(page.getByRole('button', { name: 'Add Rule' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Rule' }).click();
  await expect(page.locator('.filter-rule').first()).toBeVisible();
  expect(fatalErrors, 'Uncaught client JavaScript errors').toEqual([]);
});

test('guest: switch active/historical course sources', async ({ page }) => {
  await openCourses(page);
  const sourceButton = page.getByRole('button', { name: 'See Older' });
  await sourceButton.click();
  await expect(page.getByRole('button', { name: 'See Active' })).toBeVisible();
  await expect(page.locator('#course-count')).toContainText(/Total courses:\s*\d+/, { timeout: 60_000 });
  await page.getByRole('button', { name: 'See Active' }).click();
  await expect(page.getByRole('button', { name: 'See Older' })).toBeVisible();
  await expect(page.locator('.desktop-table tbody tr').first()).toBeAttached();
});

test('guest: protected views require login and sign-in modal opens', async ({ page }) => {
  await openCourses(page);
  await nav(page).getByRole('button', { name: 'Favourites' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to save favourites' })).toBeVisible();
  await nav(page).getByRole('button', { name: 'LEGO view' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to view plans' })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Timeline' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to view timeline' })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Sign in' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Sign in to Sisukas' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Send magic link' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).not.toBeVisible();
});

test('guest: fresh reload and desktop navigation still work', async ({ page }) => {
  await openCourses(page);
  await page.reload();
  await expect(page.locator('#course-count')).toContainText(/Total courses:\s*[1-9]\d*/, { timeout: 45_000 });
  await nav(page).getByRole('button', { name: 'Browse courses' }).click();
  await expect(page.locator('.desktop-table tbody tr').first()).toBeAttached();
});
