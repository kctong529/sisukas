# Playwright acceptance tests

Tracked by [sisukas #88](https://github.com/kctong529/sisukas/issues/88). The acceptance suite checks deployed **user-facing behavior**; it supplements Vitest unit tests and does not replace deterministic integration tests.

## Setup

From `frontend/course-browser`:

```bash
npm install -D @playwright/test        # only if not installed yet
npx playwright install chromium
npm run test:e2e:list
```

`npm install` updates `package.json` and `package-lock.json`; **commit both**. Do not use `npm audit fix --force` as part of setting up the test runner.

## Execution

```bash
npm run test:e2e:smoke
npm run test:e2e                  # all acceptance specs once later commits add them
npm run test:e2e:report          # inspect previous HTML report
```

Default target: `https://test.sisukas.eu`. Override with `SISUKAS_BASE_URL=https://...` when needed. Tests connect to a deployment; Playwright does not start Vite or Docker Compose. The deployment must be ready before the run.

## Test isolation and credentials

- The initial guest and PWA tests must not modify backend data.
- A later commit will add interactive magic-link sign-in and read-only authenticated checks. Use a **dedicated test account** and never upload cookies or magic-link URLs.
- Browser storage states go in `playwright/.auth/` and are **secrets**. They, test reports and traces are ignored by Git.
- A successful smoke run does not establish the deployed commit SHA; confirm it independently in the deployment workflow.
- Tests may fail due to availability of the test environment; distinguish environment problems from regressions.

## Commit boundaries

This first commit establishes only the test runner, configuration and documentation. It adds **no acceptance test specifications**, fixtures, production changes or CI workflow. Commit 2 adds the existing five guest/PWA scenarios, followed by authenticated workflows in commit 3.
