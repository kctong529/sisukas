begin;

alter table public."user" enable row level security;
alter table public.account enable row level security;
alter table public.session enable row level security;
alter table public.verification enable row level security;

alter table public.favourites enable row level security;
alter table public.feedback enable row level security;
alter table public.plans enable row level security;
alter table public.plan_instances enable row level security;
alter table public.course_grades enable row level security;

commit;
