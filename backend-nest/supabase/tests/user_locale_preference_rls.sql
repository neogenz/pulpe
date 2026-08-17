-- Locale preference ownership, constraints and least-privilege grants.

BEGIN;

SELECT set_config('test.owner_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES
  (current_setting('test.owner_id')::uuid, 'locale-owner@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  (current_setting('test.other_id')::uuid, 'locale-other@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.user_locale_preference (user_id, locale)
VALUES (current_setting('test.other_id')::uuid, 'de');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.owner_id'))::text,
  true
);

DO $$
DECLARE
  v_owner_id uuid := current_setting('test.owner_id')::uuid;
  v_other_id uuid := current_setting('test.other_id')::uuid;
  v_count integer;
  v_blocked boolean;
BEGIN
  INSERT INTO public.user_locale_preference (user_id, locale)
  VALUES (v_owner_id, 'en')
  ON CONFLICT (user_id) DO UPDATE SET locale = EXCLUDED.locale;

  SELECT count(*) INTO v_count FROM public.user_locale_preference;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: owner must see exactly their own preference';
  END IF;

  UPDATE public.user_locale_preference SET locale = 'it'
  WHERE user_id = v_owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: owner update should succeed';
  END IF;

  UPDATE public.user_locale_preference SET locale = 'it'
  WHERE user_id = v_other_id;
  IF FOUND THEN
    RAISE EXCEPTION 'FAIL: foreign update must be hidden by RLS';
  END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO public.user_locale_preference (user_id, locale)
    VALUES (v_other_id, 'it');
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: foreign insert must be rejected by RLS';
  END IF;

  v_blocked := false;
  BEGIN
    UPDATE public.user_locale_preference SET locale = 'es'
    WHERE user_id = v_owner_id;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: unsupported locale must violate the constraint';
  END IF;

  v_blocked := false;
  BEGIN
    DELETE FROM public.user_locale_preference WHERE user_id = v_owner_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: authenticated must not have DELETE privilege';
  END IF;

  RAISE NOTICE 'USER LOCALE PREFERENCE RLS: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
