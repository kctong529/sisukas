-- Read-only verification after applying 0005. Run via psql.
\echo === Database/project identity ===
SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), current_setting('server_version');
\echo === Table columns ===
SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('calendar_hidden_groups', 'calendar_occurrence_overrides')
ORDER BY table_name, ordinal_position;
\echo === Constraints ===
SELECT conrelid::regclass AS table_name, conname, contype,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
    'public.calendar_hidden_groups'::regclass,
    'public.calendar_occurrence_overrides'::regclass
)
ORDER BY table_name, conname;
\echo === RLS ===
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname='public'
  AND tablename IN ('calendar_hidden_groups', 'calendar_occurrence_overrides');
\echo === Policies (expect 8) ===
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('calendar_hidden_groups', 'calendar_occurrence_overrides')
ORDER BY tablename, policyname;
\echo === Indexes ===
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname='public'
  AND tablename IN ('calendar_hidden_groups', 'calendar_occurrence_overrides')
ORDER BY tablename, indexname;
\echo === Grants ===
SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('calendar_hidden_groups', 'calendar_occurrence_overrides')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
