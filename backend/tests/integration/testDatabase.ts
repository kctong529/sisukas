/**
 * Guard database-writing integration tests against an unintended target.
 *
 * The project reference must be independently checked against the
 * Supabase Test dashboard; matching a configured reference alone cannot
 * establish that a project is a test environment.
 */
export function verifyCalendarTestDatabase(): void {
  const connection = process.env.DATABASE_URL;
  const projectRef = process.env.CALENDAR_TEST_PROJECT_REF;

  if (!connection || !projectRef) {
    throw new Error('Configure DATABASE_URL and CALENDAR_TEST_PROJECT_REF in backend/.env.test');
  }

  let url: URL;
  try {
    url = new URL(connection);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
  }

  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    url.username !== `postgres.${projectRef}` ||
    !/(^|\.)pooler\.supabase\.com$/i.test(url.hostname)
  ) {
    throw new Error(
      'Refusing integration test: DATABASE_URL must use the confirmed Supabase Test pooler and postgres.<project-ref> username',
    );
  }
}
