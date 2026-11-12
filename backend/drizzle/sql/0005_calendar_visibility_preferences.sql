-- #190: Calendar visibility preferences (manual, standalone migration).
-- Run once on the verified target project with psql ON_ERROR_STOP enabled.
-- NOT managed by the incomplete historical drizzle/meta journal (#197).
-- Fail if objects already exist; inspect drift rather than silently skipping.
BEGIN;

CREATE TABLE public.calendar_hidden_groups (
    plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    course_offering_id varchar(100) NOT NULL,
    study_group_id text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT calendar_hidden_groups_pkey
        PRIMARY KEY (plan_id, course_offering_id, study_group_id),
    CONSTRAINT calendar_hidden_groups_group_size
        CHECK (octet_length(study_group_id) BETWEEN 1 AND 1024),
    CONSTRAINT calendar_hidden_groups_offering_nonempty
        CHECK (length(course_offering_id) > 0)
);

CREATE TABLE public.calendar_occurrence_overrides (
    plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    course_offering_id varchar(100) NOT NULL,
    study_group_id text NOT NULL,
    occurrence_key_version smallint NOT NULL DEFAULT 1,
    occurrence_key text NOT NULL,
    occurrence_key_hash varchar(64) NOT NULL,
    visibility text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT calendar_occurrence_overrides_pkey
        PRIMARY KEY (
            plan_id, course_offering_id, study_group_id,
            occurrence_key_version, occurrence_key_hash
        ),
    CONSTRAINT calendar_occurrence_group_size
        CHECK (octet_length(study_group_id) BETWEEN 1 AND 1024),
    CONSTRAINT calendar_occurrence_offering_nonempty
        CHECK (length(course_offering_id) > 0),
    CONSTRAINT calendar_occurrence_key_size
        CHECK (octet_length(occurrence_key) BETWEEN 1 AND 65536),
    CONSTRAINT calendar_occurrence_hash_format
        CHECK (occurrence_key_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT calendar_occurrence_hash_matches_key
        CHECK (
            occurrence_key_hash =
            encode(sha256(convert_to(occurrence_key, 'UTF8')), 'hex')
        ),
    CONSTRAINT calendar_occurrence_key_version_supported
        CHECK (occurrence_key_version = 1),
    CONSTRAINT calendar_occurrence_visibility_valid
        CHECK (visibility IN ('visible', 'hidden'))
);

-- Match the existing Supabase Data API policy pattern in 0003.
-- These policies apply to Supabase Auth JWTs; Better Auth's PostgreSQL
-- connection still requires explicit authorization in the backend.
ALTER TABLE public.calendar_hidden_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_occurrence_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.calendar_hidden_groups FROM anon, authenticated;
REVOKE ALL ON TABLE public.calendar_occurrence_overrides FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.calendar_hidden_groups, public.calendar_occurrence_overrides
    TO authenticated;

CREATE POLICY calendar_hidden_groups_select_via_plan
ON public.calendar_hidden_groups FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = calendar_hidden_groups.plan_id
      AND p.user_id = (SELECT auth.uid())::text
));
CREATE POLICY calendar_hidden_groups_insert_via_plan
ON public.calendar_hidden_groups FOR INSERT TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = calendar_hidden_groups.plan_id
      AND p.user_id = (SELECT auth.uid())::text
));
CREATE POLICY calendar_hidden_groups_update_via_plan
ON public.calendar_hidden_groups FOR UPDATE TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = calendar_hidden_groups.plan_id
      AND p.user_id = (SELECT auth.uid())::text
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = calendar_hidden_groups.plan_id
      AND p.user_id = (SELECT auth.uid())::text
));
CREATE POLICY calendar_hidden_groups_delete_via_plan
ON public.calendar_hidden_groups FOR DELETE TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = calendar_hidden_groups.plan_id
      AND p.user_id = (SELECT auth.uid())::text
));

CREATE POLICY calendar_occurrence_select_via_plan
ON public.calendar_occurrence_overrides FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = calendar_occurrence_overrides.plan_id
      AND p.user_id = (SELECT auth.uid())::text
));
CREATE POLICY calendar_occurrence_insert_via_plan
ON public.calendar_occurrence_overrides FOR INSERT TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = calendar_occurrence_overrides.plan_id
      AND p.user_id = (SELECT auth.uid())::text
));
CREATE POLICY calendar_occurrence_update_via_plan
ON public.calendar_occurrence_overrides FOR UPDATE TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = calendar_occurrence_overrides.plan_id
      AND p.user_id = (SELECT auth.uid())::text
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = calendar_occurrence_overrides.plan_id
      AND p.user_id = (SELECT auth.uid())::text
));
CREATE POLICY calendar_occurrence_delete_via_plan
ON public.calendar_occurrence_overrides FOR DELETE TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = calendar_occurrence_overrides.plan_id
      AND p.user_id = (SELECT auth.uid())::text
));
COMMIT;
