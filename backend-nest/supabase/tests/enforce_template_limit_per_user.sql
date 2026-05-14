-- Integration test for HI-30: per-user template limit trigger.
-- Validates that the BEFORE INSERT trigger on public.template prevents a user
-- from exceeding the cap of 5 templates, regardless of how many parallel
-- callers raced through the application-level check. Wraps in a transaction
-- and rolls back at the end so DB state is unaffected.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_other_user_id uuid := gen_random_uuid();
  v_count integer;
  v_caught boolean := false;
  v_caught_sqlstate text;
  v_caught_message text;
BEGIN
  -- Set up authenticated context (not strictly required for trigger, but
  -- keeps parity with the rest of the SQL tests).
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_id::text)::text,
    true
  );

  -- Create the auth user rows (FK target for template.user_id).
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES (
    v_user_id,
    'test-template-limit@local.test',
    'fake',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  );
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES (
    v_other_user_id,
    'test-template-limit-other@local.test',
    'fake',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  );

  -- Insert exactly 5 templates for the test user — should all succeed.
  FOR i IN 1..5 LOOP
    INSERT INTO public.template (user_id, name, description, is_default)
    VALUES (v_user_id, 'Template ' || i, 'limit test', false);
  END LOOP;

  SELECT count(*) INTO v_count
  FROM public.template WHERE user_id = v_user_id;
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'FAIL: expected 5 templates after seed, got %', v_count;
  END IF;

  -- 6th INSERT must be rejected by the trigger.
  BEGIN
    INSERT INTO public.template (user_id, name, description, is_default)
    VALUES (v_user_id, 'Template 6', 'over limit', false);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_caught_sqlstate := SQLSTATE;
    v_caught_message := SQLERRM;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL: 6th template insert was not rejected by trigger';
  END IF;
  IF v_caught_sqlstate <> 'P0001' THEN
    RAISE EXCEPTION 'FAIL: expected SQLSTATE P0001, got %', v_caught_sqlstate;
  END IF;
  IF v_caught_message NOT LIKE 'TEMPLATE_LIMIT_EXCEEDED%' THEN
    RAISE EXCEPTION 'FAIL: expected message prefix TEMPLATE_LIMIT_EXCEEDED, got "%"',
      v_caught_message;
  END IF;

  -- Confirm count did not increase (atomicity sanity).
  SELECT count(*) INTO v_count
  FROM public.template WHERE user_id = v_user_id;
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'FAIL: count increased after rejected insert, got %', v_count;
  END IF;

  -- Cross-user isolation: another user can still create templates up to 5
  -- without being affected by the first user's count.
  FOR i IN 1..5 LOOP
    INSERT INTO public.template (user_id, name, description, is_default)
    VALUES (v_other_user_id, 'Other ' || i, 'isolation test', false);
  END LOOP;
  SELECT count(*) INTO v_count
  FROM public.template WHERE user_id = v_other_user_id;
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'FAIL: other user expected 5 templates, got %', v_count;
  END IF;

  RAISE NOTICE 'ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
