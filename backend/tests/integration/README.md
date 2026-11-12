# Database and HTTP integration tests

These opt-in tests exercise Calendar preference persistence against a real PostgreSQL database. They create and delete fixture data, so **run them only against Supabase Test, never Supabase Production**. They are separate from unit tests, mocked HTTP route tests, and the Supabase RLS suite.

## Test suites

| Suite | What it exercises | HTTP server | Authentication |
| --- | --- | --- | --- |
| `calendarPreferences.db.test.ts` | `CalendarPreferencesService` through Drizzle and PostgreSQL | Not needed | Supplies fixture user IDs directly to the service |
| `calendarPreferences.http.test.ts` | Better Auth → Express middleware/routes → service → PostgreSQL | Starts an in-process Express server on an ephemeral loopback port | Registers isolated users through Better Auth's email/password endpoint and uses real session cookies |

The HTTP suite validates **authentication and subsequent plan-ownership authorization**. It does not test Magic Link delivery or browser login. Email/password is a *test-fixture mechanism*, **not an intended user-facing signup method**. A passing test does not establish whether password signup is enabled or disabled in production; that is a separate authentication-configuration concern.

## Prerequisites

- Install dependencies from `backend/` (`npm install`).
- Apply `drizzle/sql/0005_calendar_visibility_preferences.sql` to **Supabase Test**. Do not apply it to Production yet.
- Confirm the Supabase Test project reference in the Supabase dashboard and obtain its PostgreSQL **pooler** URL. The username must be `postgres.<TEST_PROJECT_REF>`.
- For the HTTP suite, configure `BACKEND_URL` and `BETTER_AUTH_SECRET` for local/test Better Auth use, and ensure the email/password test fixture flow is available in the test environment.

### Database configuration (both suites)

Run from `backend/`:

```sh
export CALENDAR_TEST_DATABASE_URL='postgresql://postgres.<TEST_PROJECT_REF>:<PASSWORD>@<TEST_POOLER_HOST>:6543/postgres'
export DATABASE_URL="$CALENDAR_TEST_DATABASE_URL"
export CALENDAR_TEST_PROJECT_REF='<TEST_PROJECT_REF>'
export CALENDAR_TEST_CONFIRM='sisukas-test'
```

These variables have distinct purposes:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Connection used by the application's Drizzle client |
| `CALENDAR_TEST_DATABASE_URL` | Explicit expected connection for these integration suites; must equal `DATABASE_URL` |
| `CALENDAR_TEST_PROJECT_REF` | Supabase Test project reference; must match the pooler username |
| `CALENDAR_TEST_CONFIRM` | Explicit operator acknowledgement; must equal `sisukas-test` |
| `CALENDAR_DB_TEST` | Opts into the database/service integration suite when set to `yes` |
| `CALENDAR_HTTP_TEST` | Opts into the authenticated HTTP integration suite when set to `yes` |
| `BACKEND_URL` | Better Auth base URL/origin used by the HTTP suite |
| `BETTER_AUTH_SECRET` | Better Auth signing secret for the test environment |

Both suites verify the explicit connection values and check for the two Calendar tables before creating fixtures. They reject connections that do not use the expected Supabase pooler username and hostname. **Those checks cannot independently prove that a reference belongs to Supabase Test. Verify it yourself first.**

Vitest's existing configuration loads `.env.test`. Check which environment values actually take effect; don't assume that the filename guarantees the database target. Do not commit secrets or include them in issue comments.

## Run the database/service suite

```sh
export CALENDAR_DB_TEST=yes
npx vitest run tests/integration/calendarPreferences.db.test.ts --no-file-parallelism
```

This suite creates fixture users and plans via Drizzle and exercises the service without starting an HTTP server. It covers ownership isolation, confirmed-empty reads, idempotent mutations, offering-membership checks, dormant preferences, long and malformed occurrence keys, and cascading deletion.

**Verified on Supabase Test (November 12, 2026):** 6/6 tests passed.

## Run the authenticated HTTP suite

```sh
export CALENDAR_HTTP_TEST=yes
export BACKEND_URL='http://localhost:3000'
export BETTER_AUTH_SECRET='<local-or-test-secret>'

npx vitest run tests/integration/calendarPreferences.http.test.ts --no-file-parallelism
```

The test starts an **in-process Express HTTP server** on a randomly assigned loopback port. It mounts the real Better Auth handler, session middleware, Plans routes, and Calendar preference routes. It creates owner/outsider accounts and a plan/offering through HTTP, forwards genuine session cookies, checks access isolation and persistence, removes the offering, resets preferences, and deletes the fixture plan. Its cleanup deletes only the precise fixture user IDs returned by Better Auth signup.

**The test code does not require an independently started backend process.** In the observed local setup, the suite was run with the backend server already running; if that is consistently required, investigate the local Better Auth configuration or other process dependency rather than treating it as an intentional test prerequisite. The test does not call a deployed API URL.

The suite uses the email/password signup endpoint only to obtain test sessions without depending on Magic Link email delivery. This is sufficient for Calendar authorization testing because the Calendar API receives the resulting authenticated identity, regardless of the sign-in mechanism. It does **not** certify that password signup is appropriately disabled in production.

**Verified on Supabase Test (November 12, 2026):** 4/4 tests passed.

## Regression checks

```sh
npm run build

npx vitest run \
  --exclude 'tests/rls.*.test.ts' \
  --exclude 'tests/integration/*'
```

**Verified on November 12, 2026:** TypeScript build passed; 48/48 non-RLS unit and route tests passed.

The RLS tests are a separate suite using Supabase Auth/Data API, rather than Better Auth and direct Drizzle access. Their setup and rate limits should be investigated separately.

## Fixtures, cleanup, and failures

- **Database suite:** Creates uniquely identified users, plans, and an offering directly in PostgreSQL. Deleting fixture users cascades to their plans and preference rows.
- **HTTP suite:** Creates two users via Better Auth and a plan/offering through the Plans API. It deletes the plan via HTTP and deletes its exact created user IDs via Drizzle during cleanup.
- Cleanup is attempted when tests fail normally, but force termination or connection loss can leave fixtures behind.
- Before inspecting or deleting leftovers, reconfirm that the connection points to **Supabase Test**. Look for the specific `calendar-it-owner-...`, `calendar-it-outsider-...` or `calendar-http-...@example.invalid` fixture identifiers; inspect exact records before deleting. Never run a broad prefix-based deletion.
- When a test fails, preserve the error output and check the fixture lifecycle, authentication configuration, or connection preflight before rerunning.

## Coverage boundaries and deployment

Passing these suites verifies the service and real-session HTTP routing against **Supabase Test**, but does not prove production Magic Link configuration, deployed networking/TLS/CORS, browser cookie handling, Supabase RLS policy behavior, or frontend Calendar hydration. The HTTP suite does not exercise the Magic Link flow, and neither suite generates a real SHA-256 collision. Collision handling should be tested separately through a deterministic test double.

Conflicting concurrent writes follow database execution order. A preference can become dormant when its offering is removed; this is expected by the Calendar visibility contract. The tests do not establish deterministic ordering for concurrent mutations.

**Migration 0005 is deployed only to Supabase Test. Production remains unchanged.** Defer production migration and feature enablement until the backend and frontend interactions are verified end-to-end under #190, #191, and #192, then coordinate schema deployment with the application release.
