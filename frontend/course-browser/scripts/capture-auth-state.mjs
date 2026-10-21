/* global process, console */

/** Capture a dedicated test account's Better Auth session. Local use only. */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

const baseURL = process.env.SISUKAS_BASE_URL ?? 'https://test.sisukas.eu';
const stateFile = resolve(process.env.SISUKAS_STORAGE_STATE ?? 'playwright/.auth/test-user.json');
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ baseURL });
const page = await context.newPage();
const terminal = createInterface({ input: process.stdin, output: process.stdout });
const signedIn = page.locator('nav.navbar').getByRole('button', { name: 'Sign out' });

try {
  await page.goto('/');
  console.log(`Opened ${baseURL} in a Playwright-controlled browser.`);
  console.log('Use a DEDICATED test account. Request a magic link using the site.');
  console.log('Paste the magic-link URL into the PLAYWRIGHT BROWSER address bar (not this terminal).');
  console.log('On the "Verify your email" page, click "Sign In Now" and wait for the app to redirect.');
  await terminal.question('Once signed in, press Enter to check and save the session... ');

  // The sign-out control is present only after Better Auth resolves the session.
  await signedIn.waitFor({ state: 'visible', timeout: 30_000 });
  await page.reload();
  await signedIn.waitFor({ state: 'visible', timeout: 30_000 });

  await mkdir(dirname(stateFile), { recursive: true });
  await context.storageState({ path: stateFile });
  console.log(`Session verified after reload and saved to ${stateFile}`);
  console.log('Treat this file as a secret. Do not commit or upload it.');
} catch (error) {
  console.error('No session was saved. Complete the verification button flow in the Playwright window first.');
  throw error;
} finally {
  terminal.close();
  await browser.close();
}
