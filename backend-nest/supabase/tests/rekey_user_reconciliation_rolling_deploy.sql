-- A rolling-deploy legacy rekey (v1, v2 or v3) must fail before mutating any
-- ciphertext or key_check once the person holds a starting amount. The v4 RPC
-- must refuse a payload that disagrees with the stored starting amount, then
-- rekey it with the rest and commit the canary last. People without a starting
-- amount, with or without a row, still rekey through every version.
BEGIN;

DO $$
DECLARE
  v_holder_id uuid := gen_random_uuid();
  v_no_row_id uuid := gen_random_uuid();
  v_empty_row_id uuid := gen_random_uuid();
  v_goal_id uuid := gen_random_uuid();
  v_message text;
  v_target text;
  v_starting text;
  v_key_check text;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES
    (v_holder_id, 'rekey-reconciliation-holder@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_no_row_id, 'rekey-reconciliation-none@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_empty_row_id, 'rekey-reconciliation-empty@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  INSERT INTO public.user_encryption_key (user_id, salt, key_check)
  VALUES (v_holder_id, 'salt-holder', 'check-before'),
         (v_no_row_id, 'salt-none', 'check-none'),
         (v_empty_row_id, 'salt-empty', 'check-empty');
  INSERT INTO public.savings_goal (
    id, user_id, name, target_amount, target_date, status
  ) VALUES (
    v_goal_id, v_holder_id, 'Maison', 'goal-before', '2031-06-01', 'ACTIVE'
  );
  INSERT INTO public.user_reconciliation (user_id, starting_amount, last_completed_at)
  VALUES (v_holder_id, 'starting-before', NULL),
         (v_empty_row_id, NULL, now());

  -- v1, v2 and v3 never read the starting amount: each must refuse and touch
  -- nothing.
  FOR i IN 1..3 LOOP
    v_message := NULL;
    BEGIN
      CASE i
        WHEN 1 THEN
          PERFORM public.rekey_user_encrypted_data(
            v_holder_id, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
            jsonb_build_array(jsonb_build_object(
              'id', v_goal_id, 'target_amount', 'goal-legacy',
              'original_target_amount', NULL, 'initial_amount', NULL
            )),
            '[]'::jsonb, 'check-legacy'
          );
        WHEN 2 THEN
          PERFORM public.rekey_user_encrypted_data_with_plan_withdrawals(
            v_holder_id, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
            jsonb_build_array(jsonb_build_object(
              'id', v_goal_id, 'target_amount', 'goal-legacy',
              'original_target_amount', NULL, 'initial_amount', NULL
            )),
            '[]'::jsonb, 'check-legacy'
          );
        ELSE
          PERFORM public.rekey_user_encrypted_data_with_asset_snapshots(
            v_holder_id, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
            '[]'::jsonb,
            jsonb_build_array(jsonb_build_object(
              'id', v_goal_id, 'target_amount', 'goal-legacy',
              'original_target_amount', NULL, 'initial_amount', NULL
            )),
            '[]'::jsonb, 'check-legacy'
          );
      END CASE;
    EXCEPTION WHEN OTHERS THEN
      v_message := SQLERRM;
    END;

    SELECT target_amount INTO v_target
    FROM public.savings_goal WHERE id = v_goal_id;
    SELECT starting_amount INTO v_starting
    FROM public.user_reconciliation WHERE user_id = v_holder_id;
    SELECT key_check INTO v_key_check
    FROM public.user_encryption_key WHERE user_id = v_holder_id;

    IF v_message IS DISTINCT FROM 'rekey: starting amount requires v4'
      OR v_target IS DISTINCT FROM 'goal-before'
      OR v_starting IS DISTINCT FROM 'starting-before'
      OR v_key_check IS DISTINCT FROM 'check-before'
    THEN
      RAISE EXCEPTION 'FAIL: v% rekey committed a split-key vault (%)', i, v_message;
    END IF;
  END LOOP;

  -- The backend reads its payload before the RPC takes the table lock. A
  -- starting amount written in that window is absent from the payload, so v4
  -- counts it under the lock and refuses.
  v_message := NULL;
  BEGIN
    PERFORM public.rekey_user_encrypted_data_with_starting_amount(
      v_holder_id, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'id', v_goal_id, 'target_amount', 'goal-stale',
        'original_target_amount', NULL, 'initial_amount', NULL
      )),
      '[]'::jsonb, 'check-stale'
    );
  EXCEPTION WHEN OTHERS THEN
    v_message := SQLERRM;
  END;

  SELECT target_amount INTO v_target
  FROM public.savings_goal WHERE id = v_goal_id;
  SELECT starting_amount INTO v_starting
  FROM public.user_reconciliation WHERE user_id = v_holder_id;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_holder_id;

  IF v_message IS DISTINCT FROM 'rekey: user_reconciliation holds 1 starting amounts, payload carries 0'
    OR v_target IS DISTINCT FROM 'goal-before'
    OR v_starting IS DISTINCT FROM 'starting-before'
    OR v_key_check IS DISTINCT FROM 'check-before'
  THEN
    RAISE EXCEPTION 'FAIL: a payload missing the starting amount certified a new key (%)', v_message;
  END IF;

  -- A starting amount for a person who has none would write nothing: refused.
  v_message := NULL;
  BEGIN
    PERFORM public.rekey_user_encrypted_data_with_starting_amount(
      v_empty_row_id, 'starting-forged', p_key_check => 'check-forged'
    );
  EXCEPTION WHEN OTHERS THEN
    v_message := SQLERRM;
  END;

  SELECT starting_amount INTO v_starting
  FROM public.user_reconciliation WHERE user_id = v_empty_row_id;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_empty_row_id;

  IF v_message IS DISTINCT FROM 'rekey: user_reconciliation holds 0 starting amounts, payload carries 1'
    OR v_starting IS NOT NULL
    OR v_key_check IS DISTINCT FROM 'check-empty'
  THEN
    RAISE EXCEPTION 'FAIL: a starting amount with no stored row certified a new key (%)', v_message;
  END IF;

  PERFORM public.rekey_user_encrypted_data_with_starting_amount(
    v_holder_id, 'starting-v4', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    '[]'::jsonb, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', v_goal_id, 'target_amount', 'goal-v4',
      'original_target_amount', NULL, 'initial_amount', NULL
    )),
    '[]'::jsonb, 'check-v4'
  );

  SELECT target_amount INTO v_target
  FROM public.savings_goal WHERE id = v_goal_id;
  SELECT starting_amount INTO v_starting
  FROM public.user_reconciliation WHERE user_id = v_holder_id;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_holder_id;

  IF v_target IS DISTINCT FROM 'goal-v4'
    OR v_starting IS DISTINCT FROM 'starting-v4'
    OR v_key_check IS DISTINCT FROM 'check-v4'
  THEN
    RAISE EXCEPTION 'FAIL: v4 rekey did not commit one coherent vault';
  END IF;

  -- No starting amount, no row or an empty one: every version still rekeys.
  PERFORM public.rekey_user_encrypted_data(
    v_no_row_id, p_key_check => 'check-none-v1'
  );
  PERFORM public.rekey_user_encrypted_data_with_plan_withdrawals(
    v_empty_row_id, p_key_check => 'check-empty-v2'
  );
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_no_row_id;
  IF v_key_check IS DISTINCT FROM 'check-none-v1' THEN
    RAISE EXCEPTION 'FAIL: v1 must still rekey a person with no row';
  END IF;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_empty_row_id;
  IF v_key_check IS DISTINCT FROM 'check-empty-v2' THEN
    RAISE EXCEPTION 'FAIL: v2 must still rekey a person with no starting amount';
  END IF;

  PERFORM public.rekey_user_encrypted_data_with_asset_snapshots(
    v_empty_row_id, p_key_check => 'check-empty-v3'
  );
  PERFORM public.rekey_user_encrypted_data_with_starting_amount(
    v_no_row_id, p_key_check => 'check-none-v4'
  );
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_empty_row_id;
  IF v_key_check IS DISTINCT FROM 'check-empty-v3' THEN
    RAISE EXCEPTION 'FAIL: v3 must still rekey a person with no starting amount';
  END IF;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_no_row_id;
  IF v_key_check IS DISTINCT FROM 'check-none-v4' THEN
    RAISE EXCEPTION 'FAIL: v4 must rekey a person with no row';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_reconciliation WHERE user_id = v_no_row_id
  ) THEN
    RAISE EXCEPTION 'FAIL: a rekey must not create a reconciliation row';
  END IF;

  RAISE NOTICE 'REKEY USER RECONCILIATION ROLLING DEPLOY: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
