# Database and HTTP integration tests

These opt-in tests exercise Calendar preference persistence against **Supabase Test**.
They create and delete fixture records. Never use Supabase Production.

## Suites

| Suite | What it tests | HTTP server | Authentication |
| --- | --- | --- | --- |
| `calendarPreferences.db.test.ts` | Service → Drizzle → PostgreSQL | None | Uses fixture user IDs directly |
| `calendarPreferences.http.test.ts` | Better Auth → Express → service → PostgreSQL | Starts a local, in-process Express server on an ephemeral port | Creates test users through Better Auth email/password signup and sends session cookies |

The HTTP suite verifies authenticated session resolution and plan ownership
**authorization**. Email/password signup is used only to create test fixtures;
Magic Link delivery and the user-facing login flow are out of scope. This does
not establish that email/password signup is disabled in production.

## Configuration

From `backend/`, configure **`.env.test`** using the *Supabase Test* project:

```dotenv
DATABASE_URL=postgresql://postgres.<TEST_PROJECT_REF>:<PASSWORD>@<TEST_POOLER_HOST>:6543/postgres
CALENDAR_TEST_PROJECT_REF=<TEST_PROJECT_REF>
BACKEND_URL=http://localhost:3000
BETTER_AUTH_SECRET=<TEST_SECRET>
```

`DATABASE_URL` is the same value used by the normal Drizzle client. The test
suites share one preflight helper that checks that the URL uses a Supabase
pooler and a `postgres.<CALENDAR_TEST_PROJECT_REF>` username. They also verify
that the Calendar tables from migration `0005` exist before writing fixtures.

**Verify the project reference in the Supabase dashboard.** The code cannot
independently determine whether a matching reference identifies the Test or
Production project. Never use Production credentials, and never commit `.env.test`.

Vitest automatically loads `.env.test` with `override: true`: values defined
there take precedence over shell-exported values. Variables *absent* from
`.env.test` can still be inherited from the shell, so set all required values
there and avoid sourcing production credentials into your test shell.

No duplicate database URL, confirmation string, or database-related exports
are needed. The only command-line variables below are explicit opt-in flags.

## Run

From `backend/`:

**Database/service integration (6 tests):**

```sh
CALENDAR_DB_TEST=yes npx vitest run \
  tests/integration/calendarPreferences.db.test.ts \
  --no-file-parallelism
```

This suite creates fixture users, plans, and a plan offering directly in the
test database and verifies ownership checks, sparse and idempotent mutations,
dormant preferences, long occurrence keys, and cascading deletion. It does
not need a running backend.

**Authenticated HTTP integration (4 tests):**

```sh
CALENDAR_HTTP_TEST=yes npx vitest run \
  tests/integration/calendarPreferences.http.test.ts \
  --no-file-parallelism
```

The HTTP suite starts an **in-process** Express server on an ephemeral
loopback port and uses the real Better Auth handler and Calendar/Plans routes.
It does **not** intentionally require a separately running backend. If it only
works when the development server is running, investigate the test auth/origin
configuration rather than relying on that external process.

**Build and ordinary regression tests:**

```sh
npm run build
npx vitest run \
  --exclude 'tests/rls.*.test.ts' \
  --exclude 'tests/integration/*'
```

The RLS suite is separate: it exercises Supabase Auth and the Data API, not
Better Auth through Drizzle.

## Fixture lifecycle and troubleshooting

- Database suite: creates uniquely identified users, plans, and offerings via
  Drizzle; cleanup deletes only the recorded fixture users, cascading to plans.
- HTTP suite: signs up uniquely identified users through Better Auth, creates
  the plan and offering through HTTP, and deletes only the returned fixture IDs.
- Cleanup is attempted on normal test failures. Force termination or a lost
  connection can leave fixtures. Recheck the target project before inspecting
  or removing any leftovers. Never delete broadly by a name or email prefix.
- If the preflight fails, compare `.env.test` against the Supabase **Test**
  dashboard rather than bypassing the guard. If HTTP signup or session checks
  fail, inspect Better Auth test configuration and origin/cookie handling.
- Run test suites sequentially when they use the same test database.

## Coverage and deployment boundary

These suites do **not** test production Magic Link configuration, browser
cookies, deployed networking/CORS, frontend hydration, or Supabase RLS
behavior. They also do not create a real SHA-256 collision; the service's
collision path is covered separately by a mocked regression test.

Concurrent conflicting writes are database-order dependent. Preferences may
remain dormant when an offering is removed; this is intentional.

**Migration `0005` is installed on Supabase Test only.** Do not deploy it to
Production until the Calendar frontend interactions and end-to-end acceptance
requirements under #190, #191, and #192 are verified and deployment is
coordinated with the application release.
