# Playwright acceptance tests

Tracked by [sisukas #88](https://github.com/kctong529/sisukas/issues/88). This suite checks deployed **user-facing behavior**. It supplements Vitest tests and does not replace deterministic integration tests.

## Setup

From `frontend/course-browser`:

```bash
npm install -D @playwright/test  # only if not already installed
npx playwright install chromium
npm run test:e2e:list
```

Commit both `package.json` and `package-lock.json` if installing Playwright changes them. Avoid `npm audit fix --force` as part of test setup.

## Running tests

```bash
npm run test:e2e:smoke        # Guest and PWA smoke tests
npm run test:e2e              # Regular suite; sign-out skipped
npm run test:e2e:sign-out     # Explicit sign-out; invalidates session
npm run test:e2e:report       # View Playwright report
```

The default target is `https://test.sisukas.eu`. Set `SISUKAS_BASE_URL=https://...` to test another deployment. Playwright does not start Vite or Docker Compose; the target must already be running.

## Capture an authenticated test session

The authenticated tests use a locally saved session because sisukas signs users in through an email magic link. **Use a dedicated test account** without personal data.

From `frontend/course-browser`:

```bash
node scripts/capture-auth-state.mjs
```

1. The script opens a Playwright-controlled Chromium browser at the configured deployment.
2. In **that browser**, request a sign-in magic link for the dedicated test account.
3. Open the email and copy the full magic-link URL.
4. Paste it into the **Playwright browser's address bar**, **not** the terminal.
5. On the **Verify your email** page, click **Sign In Now** and wait for the app to redirect.
6. Confirm that the signed-in navigation is visible, then return to the terminal and press **Enter**.
7. The script checks for the sign-out control, reloads the page, verifies the session persists, and saves the browser state.

Default session file: `playwright/.auth/test-user.json`. To choose a different path, set `SISUKAS_STORAGE_STATE` for both capture and test runs, if supported by the test fixture.

Then run:

```bash
npx playwright test authenticated.spec.ts
```

The authenticated suite checks session persistence, access to Favourites/LEGO/Timeline, and sign-out in an isolated browser context. It does **not** create, edit, or delete favourites or plans.

### Reusing authenticated sessions

The saved Playwright authentication state can be reused across multiple runs of the regular acceptance suite.

The default authenticated tests are read-only and do not intentionally invalidate the session:

```bash
npm run test:e2e
```

The session may still expire or be invalidated externally, in which case it must be captured again.

### Testing sign-out

Sign-out is tested separately because logging out invalidates the server-side session associated with the saved browser state.

To execute the sign-out test:

```bash
npm run test:e2e:sign-out
```

This test is excluded from normal execution unless explicitly enabled. **Running it consumes the saved authentication session.**

Afterward, capture a fresh session before running authenticated tests again:

```bash
npm run test:e2e:auth:setup
```

Use a dedicated test account and never commit or share `playwright/.auth/test-user.json`.

## Session security and test isolation

- **Treat `playwright/.auth/test-user.json` as a secret.** It may contain cookies or tokens. Keep it Git-ignored; never commit, upload, or paste its contents into an issue or chat.
- Do not share magic-link URLs: they are single-use authentication credentials.
- The capture script requires a person to complete sign-in, so it is **not** suitable for unattended CI.
- Each Playwright test uses its own browser context, but contexts may authenticate to the **same server-side account**. Future state-changing tests need test-owned records, explicit cleanup, and non-overlapping execution.
- Guest/PWA tests do not change backend records. PWA tests may create browser-local caches and service-worker state.
- A passing smoke test does not prove which Git commit is deployed. Check deployment logs separately.

## Troubleshooting

**Capture says no session was saved:** Make sure the magic-link URL was opened in the Playwright-controlled browser, then click **Sign In Now** and wait for the signed-in app before pressing Enter.

**Authenticated tests are skipped:** The storage-state file may be missing. Run the capture helper and check that it reports a successful save.

**Authenticated tests fail after previously passing:** The session may have expired or been invalidated. Run the capture helper again. Do not commit the saved state.

**Unexpected remote failures:** Check whether the test deployment is available and whether the test account has access; distinguish infrastructure failure from application regression.

## Current scope and next steps

- **Implemented:** four guest-browsing tests, one PWA offline-shell test, and three authenticated read-only/session tests.
- **Not yet covered:** favourites/plan mutations and persistence, detailed filtering and mobile workflows, LEGO study-group changes, API failure/recovery cases, and PWA upgrades between distinct deployments. These are tracked in #88.
- **CI:** integration is planned; credential-dependent deployment checks should run separately from deterministic PR tests.
