begin;

------------------------------------------------------------------------------
-- 1) CLEAN UP LEGACY DATA
--    Ensure: if a user has plans, exactly one is active
------------------------------------------------------------------------------

-- 1a) If a user has MULTIPLE active plans, keep the newest one
with ranked_active as (
  select
    id,
    user_id,
    row_number() over (
      partition by user_id
      order by updated_at desc nulls last,
               created_at desc nulls last,
               id desc
    ) as rn
  from public.plans
  where is_active = true
)
update public.plans p
set is_active = false,
    updated_at = now()
from ranked_active r
where p.id = r.id
  and r.rn > 1;

-- 1b) If a user has plans but ZERO active plans, activate one deterministically
with users_without_active as (
  select user_id
  from public.plans
  group by user_id
  having sum(case when is_active then 1 else 0 end) = 0
),
pick_one as (
  select distinct on (p.user_id)
    p.id
  from public.plans p
  join users_without_active u on u.user_id = p.user_id
  order by p.user_id,
           p.updated_at desc nulls last,
           p.created_at desc,
           p.id desc
)
update public.plans p
set is_active = true,
    updated_at = now()
from pick_one x
where p.id = x.id;

------------------------------------------------------------------------------
-- 2) AT MOST ONE ACTIVE PLAN PER USER (HARD GUARANTEE)
--    Prevents races / double-actives
------------------------------------------------------------------------------

create unique index if not exists plans_one_active_per_user
on public.plans (user_id)
where is_active = true;

------------------------------------------------------------------------------
-- 3) EXACTLY ONE ACTIVE PLAN WHEN PLANS EXIST (STRICT INVARIANT)
--    Enforced at COMMIT time so multi-step updates are allowed
------------------------------------------------------------------------------

create or replace function public.enforce_exactly_one_active_plan()
returns trigger
language plpgsql
as $$
declare
  v_user_id text;
  v_total int;
  v_active int;
begin
  -- Identify affected user
  v_user_id := coalesce(new.user_id, old.user_id);

  -- Total plans for user
  select count(*) into v_total
  from public.plans
  where user_id = v_user_id;

  -- If user has no plans, invariant does not apply
  if v_total = 0 then
    return null;
  end if;

  -- Active plans for user
  select count(*) into v_active
  from public.plans
  where user_id = v_user_id
    and is_active = true;

  -- Must be EXACTLY one
  if v_active <> 1 then
    raise exception
      using
        errcode = '23514',
        message = format(
          'plans invariant violated for user %s: expected exactly 1 active plan (found %s)',
          v_user_id, v_active
        );
  end if;

  return null;
end;
$$;

drop trigger if exists plans_exactly_one_active_per_user on public.plans;

create constraint trigger plans_exactly_one_active_per_user
after insert or update or delete on public.plans
deferrable initially deferred
for each row
execute function public.enforce_exactly_one_active_plan();

commit;
