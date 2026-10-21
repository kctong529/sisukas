import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';

/** Read-only authenticated smoke tests use this local, gitignored browser state. */
export const authStatePath = resolve(
  process.env.SISUKAS_STORAGE_STATE ?? 'playwright/.auth/test-user.json',
);
export const hasAuthState = existsSync(authStatePath);
export const anonymousStorageState = { cookies: [], origins: [] };

export function navigation(page: Page) {
  return page.locator('nav.navbar');
}

export async function expectSignedIn(page: Page) {
  await page.goto('/');
  await expect(navigation(page).getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 30_000 });
}
