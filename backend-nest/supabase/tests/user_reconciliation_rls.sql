-- Reconciliation state ownership, constraints, least-privilege grants and
-- cascade on user deletion.

BEGIN;

SELECT set_config('test.owner_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES
  (current_setting('test.owner_id')::uuid, 'reconciliation-owner@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  (current_setting('test.other_id')::uuid, 'reconciliation-other@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.user_reconciliation (user_id, starting_amount)
VALUES (current_setting('test.other_id')::uuid, 'other-ciphertext');

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
  INSERT INTO public.user_reconciliation (user_id, starting_amount)
  VALUES (v_owner_id, 'owner-ciphertext')
  ON CONFLICT (user_id) DO UPDATE SET starting_amount = EXCLUDED.starting_amount;

  SELECT count(*) INTO v_count FROM public.user_reconciliation;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: owner must see exactly their own row';
  END IF;

  UPDATE public.user_reconciliation
  SET starting_amount = NULL, last_completed_at = now()
  WHERE user_id = v_owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: owner update should succeed';
  END IF;

  UPDATE public.user_reconciliation SET starting_amount = 'forged'
  WHERE user_id = v_other_id;
  IF FOUND THEN
    RAISE EXCEPTION 'FAIL: foreign update must be hidden by RLS';
  END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO public.user_reconciliation (user_id, starting_amount)
    VALUES (v_other_id, 'forged');
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: foreign insert must be rejected by RLS';
  END IF;

  v_blocked := false;
  BEGIN
    UPDATE public.user_reconciliation SET starting_amount = ' '
    WHERE user_id = v_owner_id;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: a blank starting amount must violate the constraint';
  END IF;

  v_blocked := false;
  BEGIN
    DELETE FROM public.user_reconciliation WHERE user_id = v_owner_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: authenticated must not have DELETE privilege';
  END IF;
END $$;

SET LOCAL ROLE anon;

DO $$
DECLARE
  v_blocked boolean := false;
BEGIN
  BEGIN
    PERFORM 1 FROM public.user_reconciliation;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: anon must not read reconciliation rows';
  END IF;
END $$;

RESET ROLE;

DO $$
DECLARE
  v_owner_id uuid := current_setting('test.owner_id')::uuid;
  v_other_id uuid := current_setting('test.other_id')::uuid;
BEGIN
  DELETE FROM auth.users WHERE id = v_owner_id;
  IF EXISTS (
    SELECT 1 FROM public.user_reconciliation WHERE user_id = v_owner_id
  ) THEN
    RAISE EXCEPTION 'FAIL: deleting the user must delete their row';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_reconciliation WHERE user_id = v_other_id
  ) THEN
    RAISE EXCEPTION 'FAIL: deleting a user must keep the other rows';
  END IF;

  RAISE NOTICE 'USER RECONCILIATION RLS: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
