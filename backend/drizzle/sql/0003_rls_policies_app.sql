begin;

revoke all on table public.favourites from anon, authenticated;
revoke all on table public.feedback from anon, authenticated;
revoke all on table public.plans from anon, authenticated;
revoke all on table public.plan_instances from anon, authenticated;
revoke all on table public.course_grades from anon, authenticated;

grant select, insert, update, delete on table public.favourites to authenticated;
grant select, insert, update, delete on table public.feedback to authenticated;
grant select, insert, update, delete on table public.plans to authenticated;
grant select, insert, update, delete on table public.plan_instances to authenticated;
grant select, insert, update, delete on table public.course_grades to authenticated;

-- favourites (user_id TEXT)
drop policy if exists favourites_select_own on public.favourites;
drop policy if exists favourites_insert_own on public.favourites;
drop policy if exists favourites_update_own on public.favourites;
drop policy if exists favourites_delete_own on public.favourites;

create policy favourites_select_own
on public.favourites
for select
to authenticated
using (user_id = auth.uid()::text);

create policy favourites_insert_own
on public.favourites
for insert
to authenticated
with check (user_id = auth.uid()::text);

create policy favourites_update_own
on public.favourites
for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

create policy favourites_delete_own
on public.favourites
for delete
to authenticated
using (user_id = auth.uid()::text);

-- feedback (user_id TEXT)
drop policy if exists feedback_select_own on public.feedback;
drop policy if exists feedback_insert_own on public.feedback;
drop policy if exists feedback_update_own on public.feedback;
drop policy if exists feedback_delete_own on public.feedback;

create policy feedback_select_own
on public.feedback
for select
to authenticated
using (user_id = auth.uid()::text);

create policy feedback_insert_own
on public.feedback
for insert
to authenticated
with check (user_id = auth.uid()::text);

create policy feedback_update_own
on public.feedback
for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

create policy feedback_delete_own
on public.feedback
for delete
to authenticated
using (user_id = auth.uid()::text);

-- plans (user_id TEXT)
drop policy if exists plans_select_own on public.plans;
drop policy if exists plans_insert_own on public.plans;
drop policy if exists plans_update_own on public.plans;
drop policy if exists plans_delete_own on public.plans;

create policy plans_select_own
on public.plans
for select
to authenticated
using (user_id = auth.uid()::text);

create policy plans_insert_own
on public.plans
for insert
to authenticated
with check (user_id = auth.uid()::text);

create policy plans_update_own
on public.plans
for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

create policy plans_delete_own
on public.plans
for delete
to authenticated
using (user_id = auth.uid()::text);

-- plan_instances: ownership via parent plan
drop policy if exists plan_instances_select_via_plan on public.plan_instances;
drop policy if exists plan_instances_insert_via_plan on public.plan_instances;
drop policy if exists plan_instances_update_via_plan on public.plan_instances;
drop policy if exists plan_instances_delete_via_plan on public.plan_instances;

create policy plan_instances_select_via_plan
on public.plan_instances
for select
to authenticated
using (
  exists (
    select 1
    from public.plans p
    where p.id = plan_instances.plan_id
      and p.user_id = auth.uid()::text
  )
);

create policy plan_instances_insert_via_plan
on public.plan_instances
for insert
to authenticated
with check (
  exists (
    select 1
    from public.plans p
    where p.id = plan_instances.plan_id
      and p.user_id = auth.uid()::text
  )
);

create policy plan_instances_update_via_plan
on public.plan_instances
for update
to authenticated
using (
  exists (
    select 1
    from public.plans p
    where p.id = plan_instances.plan_id
      and p.user_id = auth.uid()::text
  )
)
with check (
  exists (
    select 1
    from public.plans p
    where p.id = plan_instances.plan_id
      and p.user_id = auth.uid()::text
  )
);

create policy plan_instances_delete_via_plan
on public.plan_instances
for delete
to authenticated
using (
  exists (
    select 1
    from public.plans p
    where p.id = plan_instances.plan_id
      and p.user_id = auth.uid()::text
  )
);

-- course_grades (user_id TEXT, PK (user_id, course_unit_id))
drop policy if exists course_grades_select_own on public.course_grades;
drop policy if exists course_grades_insert_own on public.course_grades;
drop policy if exists course_grades_update_own on public.course_grades;
drop policy if exists course_grades_delete_own on public.course_grades;

create policy course_grades_select_own
on public.course_grades
for select
to authenticated
using (user_id = auth.uid()::text);

create policy course_grades_insert_own
on public.course_grades
for insert
to authenticated
with check (user_id = auth.uid()::text);

create policy course_grades_update_own
on public.course_grades
for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

create policy course_grades_delete_own
on public.course_grades
for delete
to authenticated
using (user_id = auth.uid()::text);

commit;
