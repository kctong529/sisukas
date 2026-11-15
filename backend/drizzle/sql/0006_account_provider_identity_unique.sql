-- #215: An external provider identity must belong to
-- at most one Sisukas user.
--
-- Does not modify existing account rows.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.account
        GROUP BY provider_id, account_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Duplicate provider identities exist; migration aborted';
    END IF;
END;
$$;

CREATE UNIQUE INDEX account_provider_identity_unique
    ON public.account (provider_id, account_id);

COMMIT;
