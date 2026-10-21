import { expect, test } from '@playwright/test';
import {
  anonymousStorageState,
  authStatePath,
  expectSignedIn,
  hasAuthState,
  navigation,
} from './fixtures/auth';

// Run only with an explicitly captured, dedicated test-account session.
// An absent file is not a passing authentication test: the run reports skips.
test.skip(!hasAuthState, 'Run `node scripts/capture-auth-state.mjs` with a dedicated test account first.');
test.use({ storageState: hasAuthState ? authStatePath : anonymousStorageState });

test('authenticated session survives reload and favourites load', async ({ page }) => {
  await expectSignedIn(page);
  await page.reload();
  await expect(navigation(page).getByRole('button', { name: 'Sign out' })).toBeVisible();

  await navigation(page).getByRole('button', { name: 'Favourites' }).click();
  await expect(page.locator('.favourites-container').getByRole('heading', { name: 'Your Favourites' })).toBeVisible();
  await expect(page.locator('.favourites-container').getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);
});

test('authenticated users can open LEGO and timeline without sign-in prompts', async ({ page }) => {
  await expectSignedIn(page);
  await navigation(page).getByRole('button', { name: 'LEGO view' }).click();
  await expect(page.locator('.lego-view').getByRole('heading', { name: 'Sign in to view plans' })).toHaveCount(0);
  await expect(page.locator('.lego-view').getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);

  await navigation(page).getByRole('button', { name: 'Timeline' }).click();
  await expect(page.locator('.period-timeline')).toBeVisible();
  await expect(page.locator('.period-timeline').getByRole('heading', { name: 'Sign in to view timeline' })).toHaveCount(0);
});

test('sign-out removes authenticated access in the current browser context', async ({ page }) => {
  await expectSignedIn(page);
  await navigation(page).getByRole('button', { name: 'Sign out' }).click();
  await expect(navigation(page).getByRole('button', { name: 'Sign in' })).toBeVisible();

  await navigation(page).getByRole('button', { name: 'Favourites' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to save favourites' })).toBeVisible();
  await page.reload();
  await expect(navigation(page).getByRole('button', { name: 'Sign in' })).toBeVisible();
});
