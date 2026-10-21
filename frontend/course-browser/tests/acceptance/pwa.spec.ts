import { expect, test } from '@playwright/test';

test('PWA registers a controlling service worker and serves cached shell offline', async ({ page, context }) => {
  test.slow();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Browse courses' })).toBeVisible();
  await expect(page.locator('#course-count')).toContainText(/Total courses:\s*[1-9]\d*/, { timeout: 45_000 });
  const registered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>(resolve => setTimeout(() => resolve(null), 20_000)),
    ]);
    return !!registration?.active;
  });
  expect(registered, 'Expected active service worker after online visit').toBe(true);
  // One more online reload allows an activating worker to take control.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Browse courses' })).toBeVisible();
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Browse courses' })).toBeVisible({ timeout: 15_000 });
  } finally {
    await context.setOffline(false);
  }
  await page.reload();
  await expect(page.getByRole('button', { name: 'Browse courses' })).toBeVisible();
});
