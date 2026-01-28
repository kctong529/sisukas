begin;

-- Lock down table privileges (RLS is not enough on its own)
revoke all on table public."user" from anon, authenticated;
revoke all on table public.account from anon, authenticated;
revoke all on table public.session from anon, authenticated;
revoke all on table public.verification from anon, authenticated;

grant select, insert, update, delete on table public."user" to authenticated;
grant select, insert, update, delete on table public.account to authenticated;
grant select, insert, update, delete on table public.session to authenticated;
grant select, insert, update, delete on table public.verification to authenticated;

-- -------------------------
-- user (id is TEXT)
-- -------------------------
drop policy if exists user_select_own on public."user";
drop policy if exists user_insert_own on public."user";
drop policy if exists user_update_own on public."user";
drop policy if exists user_delete_own on public."user";

create policy user_select_own
on public."user"
for select
to authenticated
using (id = auth.uid()::text);

create policy user_insert_own
on public."user"
for insert
to authenticated
with check (id = auth.uid()::text);

create policy user_update_own
on public."user"
for update
to authenticated
using (id = auth.uid()::text)
with check (id = auth.uid()::text);

create policy user_delete_own
on public."user"
for delete
to authenticated
using (id = auth.uid()::text);

-- -------------------------
-- account (user_id is TEXT)
-- -------------------------
drop policy if exists account_select_own on public.account;
drop policy if exists account_insert_own on public.account;
drop policy if exists account_update_own on public.account;
drop policy if exists account_delete_own on public.account;

create policy account_select_own
on public.account
for select
to authenticated
using (user_id = auth.uid()::text);

create policy account_insert_own
on public.account
for insert
to authenticated
with check (user_id = auth.uid()::text);

create policy account_update_own
on public.account
for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

create policy account_delete_own
on public.account
for delete
to authenticated
using (user_id = auth.uid()::text);

-- -------------------------
-- session (user_id is TEXT)
-- -------------------------
drop policy if exists session_select_own on public.session;
drop policy if exists session_insert_own on public.session;
drop policy if exists session_update_own on public.session;
drop policy if exists session_delete_own on public.session;

create policy session_select_own
on public.session
for select
to authenticated
using (user_id = auth.uid()::text);

create policy session_insert_own
on public.session
for insert
to authenticated
with check (user_id = auth.uid()::text);

create policy session_update_own
on public.session
for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

create policy session_delete_own
on public.session
for delete
to authenticated
using (user_id = auth.uid()::text);

-- -------------------------
-- verification
--
-- Deny all for authenticated users.
-- (service_role can still manage rows because it bypasses RLS)
-- -------------------------
drop policy if exists verification_deny_all on public.verification;

create policy verification_deny_all
on public.verification
for all
to authenticated
using (false)
with check (false);

commit;
