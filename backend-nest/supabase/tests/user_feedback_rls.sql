-- PUL-357: private feedback is owner-insert-only for client roles.

BEGIN;

SELECT set_config('test.feedback_owner_id', gen_random_uuid()::text, true);
SELECT set_config('test.feedback_other_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES
  (current_setting('test.feedback_owner_id')::uuid,
   'feedback-owner@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated'),
  (current_setting('test.feedback_other_id')::uuid,
   'feedback-other@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated');

DO $$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.user_feedback', 'INSERT')
    OR has_table_privilege('authenticated', 'public.user_feedback', 'SELECT')
    OR has_table_privilege('authenticated', 'public.user_feedback', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.user_feedback', 'DELETE')
  THEN
    RAISE EXCEPTION 'FAIL: authenticated must have INSERT only';
  END IF;

  IF has_table_privilege('anon', 'public.user_feedback', 'INSERT')
    OR has_table_privilege('anon', 'public.user_feedback', 'SELECT')
    OR has_table_privilege('anon', 'public.user_feedback', 'UPDATE')
    OR has_table_privilege('anon', 'public.user_feedback', 'DELETE')
  THEN
    RAISE EXCEPTION 'FAIL: anon must have no feedback privileges';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.feedback_owner_id'))::text,
  true
);

INSERT INTO public.user_feedback (
  user_id,
  overall_rating,
  current_month,
  comment,
  app_version,
  ios_version
) VALUES (
  current_setting('test.feedback_owner_id')::uuid,
  5,
  4,
  'Rapide à remplir',
  '1.4.0',
  '19.0'
);

DO $$
DECLARE
  v_blocked boolean;
BEGIN
  v_blocked := false;
  BEGIN
    INSERT INTO public.user_feedback (
      user_id, overall_rating, app_version, ios_version
    ) VALUES (
      current_setting('test.feedback_other_id')::uuid, 4, '1.4.0', '19.0'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: foreign insert must be rejected by RLS';
  END IF;

  v_blocked := false;
  BEGIN
    PERFORM * FROM public.user_feedback;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: authenticated SELECT must be denied';
  END IF;

  v_blocked := false;
  BEGIN
    UPDATE public.user_feedback SET overall_rating = 1;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: authenticated UPDATE must be denied';
  END IF;

  v_blocked := false;
  BEGIN
    DELETE FROM public.user_feedback;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: authenticated DELETE must be denied';
  END IF;
END $$;

RESET ROLE;

SET LOCAL ROLE anon;
DO $$
DECLARE
  v_blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.user_feedback (
      user_id, overall_rating, app_version, ios_version
    ) VALUES (
      current_setting('test.feedback_owner_id')::uuid, 3, '1.4.0', '19.0'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: anon INSERT must be denied';
  END IF;
END $$;

RESET ROLE;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.user_feedback;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: exactly one owner row must remain, found %', v_count;
  END IF;

  RAISE NOTICE 'USER FEEDBACK RLS: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
