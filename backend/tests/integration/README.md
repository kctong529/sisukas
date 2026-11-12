# Database integration tests

These tests exercise backend services against a real PostgreSQL database. Unlike unit and mocked-route tests, they create and delete database records.

**Run them only against Supabase Test, never Production.** The suites are opt-in and must explicitly verify their target database before writing fixtures.

## Calendar preference persistence

`calendarPreferences.db.test.ts` exercises `CalendarPreferencesService` against the two tables introduced by `drizzle/sql/0005_calendar_visibility_preferences.sql`:

- `calendar_hidden_groups`
- `calendar_occurrence_overrides`

It checks plan ownership isolation, confirmed-empty reads, idempotent group and occurrence mutations, offering membership, dormant preferences after offering removal, long/invalid occurrence keys, and cascading deletion when a plan is removed.

### Prerequisites

- The backend dependencies are installed (`npm install` from `backend/`).
- Migration `0005_calendar_visibility_preferences.sql` has been applied to **Supabase Test**.
- You have a PostgreSQL connection URL for the **test** project's Supabase pooler. Its username must be `postgres.<test-project-ref>`.
- You have independently verified the test project reference in the Supabase dashboard.

### Run

From `backend/`, set these variables in your current shell. Do not put credentials in Git or copy them into issue comments:

```bash
export CALENDAR_TEST_DATABASE_URL='postgresql://postgres.<TEST_PROJECT_REF>:<PASSWORD>@<TEST_POOLER_HOST>:6543/postgres'
export CALENDAR_TEST_PROJECT_REF='<TEST_PROJECT_REF>'
export CALENDAR_TEST_CONFIRM='sisukas-test'
export CALENDAR_DB_TEST=yes
export DATABASE_URL="$CALENDAR_TEST_DATABASE_URL"

npx vitest run tests/integration/calendarPreferences.db.test.ts --no-file-parallelism
```

Replace the placeholders with values from **Supabase Test**. The suite skips when `CALENDAR_DB_TEST` is not `yes`. When enabled, its setup checks that:

1. `DATABASE_URL` exactly matches `CALENDAR_TEST_DATABASE_URL`.
2. The URL points to a Supabase pooler and its username embeds `CALENDAR_TEST_PROJECT_REF`.
3. `CALENDAR_TEST_CONFIRM` is `sisukas-test`.
4. Both Calendar preference tables exist.

These checks reduce the risk of using the wrong database, but the operator must still verify the project reference. **Do not bypass the preflight to make a failed run proceed.** The suite currently rejects direct PostgreSQL URLs by design.

Note: Vitest loads `.env.test` through the existing configuration. Inspect which values are actually effective before enabling this suite; the explicit environment variables above are intended to select the test database.

### Fixtures and cleanup

Each run creates uniquely named test users, plans, and a plan offering, then deletes its fixture users during cleanup. Deleting the users cascades through their plans and Calendar preference rows. The suite also verifies cascading preference deletion when a plan is removed.

If the process is forcibly terminated, cleanup may not run. Check the **test database** for leftover users with IDs beginning with `calendar-it-owner-` or `calendar-it-outsider-` before manually removing them; verify ownership of any candidate records first.

### Other checks

```bash
# Backend TypeScript
npm run build

# Unit and mocked-route tests, excluding RLS and database integration suites
npx vitest run \
  --exclude 'tests/rls.*.test.ts' \
  --exclude 'tests/integration/*'
```

The existing RLS test suite is separate: it uses Supabase Auth/Data API rather than the backend's direct Drizzle connection, and may encounter Auth sign-in rate limits.

### Coverage boundaries

A passing database integration run **does not** demonstrate:

- Real Better Auth login/session cookies through the Express API (requires authenticated HTTP testing).
- Supabase RLS policy behavior for authenticated Supabase Auth users (requires the separate RLS suite).
- A real SHA-256 collision (use a controlled test double to exercise collision-handling branches).
- Deterministic ordering for competing concurrent writes or resets.
- Frontend Calendar hydration or interaction behavior (tracked in #191 and #192).

The Calendar schema has been applied to **Supabase Test only**. Do not apply it to Production until backend and frontend end-to-end requirements are verified and the deployment is coordinated.
