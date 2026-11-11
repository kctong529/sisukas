-- #190: Test the proposed occurrence composite primary key without changing
-- persistent database objects. Run only on an intentionally selected TEST DB.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE calendar_occurrence_pk_probe (
  plan_id uuid NOT NULL,
  course_offering_id varchar(100) NOT NULL,
  study_group_id text NOT NULL,
  occurrence_key_version smallint NOT NULL DEFAULT 1,
  occurrence_key text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('visible', 'hidden')),
  PRIMARY KEY (plan_id, course_offering_id, study_group_id,
               occurrence_key_version, occurrence_key)
) ON COMMIT DROP;

DO $$
DECLARE
  sample record;
  key_text text;
  err_msg text;
  err_state text;
BEGIN
  FOR sample IN
    SELECT * FROM (VALUES
      ('series-normal', 0, 10),
      ('fallback-200', 200, 10),
      ('fallback-800', 800, 10),
      ('fallback-1500', 1500, 10),
      ('fallback-2400', 2400, 10),
      ('fallback-3500', 3500, 10),
      ('fallback-5000', 5000, 10),
      ('fallback-1500-long-group', 1500, 500)
    ) AS scenarios(label, notice_length, group_length)
  LOOP
    IF sample.label = 'series-normal' THEN
      key_text := '["series","offering-1","group-1","series-1",1790000000000]';
    ELSE
      -- JSON.stringify-compatible compact ASCII JSON for this controlled probe.
      key_text := '["fallback","offering-1","group-1",1790000000000,' ||
         '1790003600000,["room-1"],false,false,"' ||
         (
            SELECT left(
              string_agg(md5(i::text || ':calendar-probe'), '' ORDER BY i),
              sample.notice_length
            )
            FROM generate_series(
              1,
              (sample.notice_length + 31) / 32
            ) AS s(i)
          ) || '"]';
    END IF;
    BEGIN
      INSERT INTO calendar_occurrence_pk_probe
        (plan_id, course_offering_id, study_group_id,
         occurrence_key_version, occurrence_key, visibility)
      VALUES
        ('11111111-1111-4111-8111-111111111111', 'offering-1',
         (
            SELECT left(
              string_agg(md5(i::text || ':calendar-group'), '' ORDER BY i),
              sample.group_length
            )
            FROM generate_series(
              1,
              (sample.group_length + 31) / 32
            ) AS s(i)
          ), 1, key_text, 'hidden');
      RAISE NOTICE '%: PASS; key_bytes=%, group_bytes=%',
        sample.label, octet_length(key_text), sample.group_length;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS err_msg = MESSAGE_TEXT, err_state = RETURNED_SQLSTATE;
      RAISE NOTICE '%: FAIL SQLSTATE %; key_bytes=%, group_bytes=%; %',
        sample.label, err_state, octet_length(key_text), sample.group_length, err_msg;
    END;
  END LOOP;
END $$;
ROLLBACK;
