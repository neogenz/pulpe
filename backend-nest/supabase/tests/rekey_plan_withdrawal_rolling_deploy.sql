-- A rolling-deploy legacy rekey must fail before mutating any ciphertext or
-- key_check once the user owns a direct savings-goal plan withdrawal. The v2
-- RPC must then rekey every representation and commit the canary last.
BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_goal_id uuid := gen_random_uuid();
  v_plan_id uuid := gen_random_uuid();
  v_caught boolean := false;
  v_target text;
  v_plan_amount text;
  v_key_check text;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES (
    v_user_id, 'rekey-plan-rolling@local.test', 'fake',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
  );
  INSERT INTO public.user_encryption_key (user_id, salt, key_check)
  VALUES (v_user_id, 'salt-before', 'check-before');
  INSERT INTO public.savings_goal (
    id, user_id, name, target_amount, target_date, status
  ) VALUES (
    v_goal_id, v_user_id, 'Maison', 'goal-before', '2031-06-01', 'ACTIVE'
  );
  INSERT INTO public.savings_goal_plan_withdrawal (
    id, savings_goal_id, user_id, month, year, amount
  ) VALUES (
    v_plan_id, v_goal_id, v_user_id, 6, 2030, 'plan-before'
  );

  BEGIN
    PERFORM public.rekey_user_encrypted_data(
      v_user_id,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'id', v_goal_id,
        'target_amount', 'goal-legacy',
        'original_target_amount', NULL,
        'initial_amount', NULL
      )),
      '[]'::jsonb,
      'check-legacy'
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;

  SELECT target_amount INTO v_target
  FROM public.savings_goal WHERE id = v_goal_id;
  SELECT amount INTO v_plan_amount
  FROM public.savings_goal_plan_withdrawal WHERE id = v_plan_id;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_user_id;

  IF NOT v_caught
    OR v_target <> 'goal-before'
    OR v_plan_amount <> 'plan-before'
    OR v_key_check <> 'check-before'
  THEN
    RAISE EXCEPTION 'FAIL: legacy rekey committed a split-key vault';
  END IF;

  PERFORM public.rekey_user_encrypted_data_with_plan_withdrawals(
    v_user_id,
    jsonb_build_array(jsonb_build_object('id', v_plan_id, 'amount', 'plan-v2')),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', v_goal_id,
      'target_amount', 'goal-v2',
      'original_target_amount', NULL,
      'initial_amount', NULL
    )),
    '[]'::jsonb,
    'check-v2'
  );

  SELECT target_amount INTO v_target
  FROM public.savings_goal WHERE id = v_goal_id;
  SELECT amount INTO v_plan_amount
  FROM public.savings_goal_plan_withdrawal WHERE id = v_plan_id;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_user_id;

  IF v_target <> 'goal-v2'
    OR v_plan_amount <> 'plan-v2'
    OR v_key_check <> 'check-v2'
  THEN
    RAISE EXCEPTION 'FAIL: v2 rekey did not commit one coherent vault';
  END IF;

  RAISE NOTICE 'REKEY PLAN WITHDRAWAL ROLLING DEPLOY: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
