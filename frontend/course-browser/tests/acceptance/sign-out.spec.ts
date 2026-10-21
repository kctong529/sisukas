import { expect, test } from '@playwright/test';
import {
  anonymousStorageState,
  authStatePath,
  expectSignedIn,
  hasAuthState,
  navigation,
} from './fixtures/auth';

// Signing out invalidates the server-side session shared by the saved
// storage state. This test must be explicitly enabled.
const runSignOut = process.env.SISUKAS_TEST_SIGN_OUT === '1';

test.skip(
  !runSignOut,
  'Sign-out test is opt-in. Set SISUKAS_TEST_SIGN_OUT=1 to run it.',
);

test.skip(
  !hasAuthState,
  'Capture a fresh session with `npm run test:e2e:auth:setup` first.',
);

test.use({
  storageState: hasAuthState ? authStatePath : anonymousStorageState,
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
