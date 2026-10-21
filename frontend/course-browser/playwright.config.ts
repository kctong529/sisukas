import { defineConfig, devices } from '@playwright/test';

/** Deployment smoke tests. No local server is launched by Playwright. */
export default defineConfig({
  testDir: './tests/acceptance',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.SISUKAS_BASE_URL ?? 'https://test.sisukas.eu',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
