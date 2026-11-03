-- A rolling-deploy legacy rekey (v1 or v2) must fail before mutating any
-- ciphertext or key_check once the user owns an asset snapshot. The v3 RPC must
-- refuse a payload that does not carry every snapshot, then rekey every
-- representation and commit the canary last.
BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_other_user_id uuid := gen_random_uuid();
  v_goal_id uuid := gen_random_uuid();
  v_plan_id uuid := gen_random_uuid();
  v_category_id uuid := gen_random_uuid();
  v_asset_id uuid := gen_random_uuid();
  v_snapshot_id uuid := gen_random_uuid();
  v_message text;
  v_target text;
  v_plan_amount text;
  v_value text;
  v_key_check text;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES
    (v_user_id, 'rekey-asset-rolling@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_other_user_id, 'rekey-asset-clean@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  INSERT INTO public.user_encryption_key (user_id, salt, key_check)
  VALUES (v_user_id, 'salt-before', 'check-before'),
         (v_other_user_id, 'salt-clean', 'check-clean');
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
  INSERT INTO public.asset_category (id, user_id, name)
  VALUES (v_category_id, v_user_id, 'Immobilier');
  INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
  VALUES (v_asset_id, v_user_id, v_category_id, 'Appartement', 'CHF', 'own');
  INSERT INTO public.asset_snapshot (id, user_id, asset_id, value)
  VALUES (v_snapshot_id, v_user_id, v_asset_id, 'value-before');

  -- v1 ignores both newer tables: it must refuse and touch nothing.
  v_message := NULL;
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
    v_message := SQLERRM;
  END;

  SELECT target_amount INTO v_target
  FROM public.savings_goal WHERE id = v_goal_id;
  SELECT amount INTO v_plan_amount
  FROM public.savings_goal_plan_withdrawal WHERE id = v_plan_id;
  SELECT value INTO v_value
  FROM public.asset_snapshot WHERE id = v_snapshot_id;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_user_id;

  IF v_message IS DISTINCT FROM 'rekey: asset snapshot requires v3'
    OR v_target <> 'goal-before'
    OR v_plan_amount <> 'plan-before'
    OR v_value <> 'value-before'
    OR v_key_check <> 'check-before'
  THEN
    RAISE EXCEPTION 'FAIL: v1 rekey committed a split-key vault (%)', v_message;
  END IF;

  -- v2 rekeys plan withdrawals but not snapshots: same refusal, same silence.
  v_message := NULL;
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    v_message := SQLERRM;
  END;

  SELECT target_amount INTO v_target
  FROM public.savings_goal WHERE id = v_goal_id;
  SELECT amount INTO v_plan_amount
  FROM public.savings_goal_plan_withdrawal WHERE id = v_plan_id;
  SELECT value INTO v_value
  FROM public.asset_snapshot WHERE id = v_snapshot_id;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_user_id;

  IF v_message IS DISTINCT FROM 'rekey: asset snapshot requires v3'
    OR v_target <> 'goal-before'
    OR v_plan_amount <> 'plan-before'
    OR v_value <> 'value-before'
    OR v_key_check <> 'check-before'
  THEN
    RAISE EXCEPTION 'FAIL: v2 rekey committed a split-key vault (%)', v_message;
  END IF;

  -- The backend reads its payload before the RPC takes the table lock. A
  -- snapshot committed in that window is absent from the payload, so an
  -- id-by-id assertion would pass while that row keeps its old-DEK
  -- ciphertext. The v3 RPC counts the owner's rows under the lock and refuses.
  v_message := NULL;
  BEGIN
    PERFORM public.rekey_user_encrypted_data_with_asset_snapshots(
      v_user_id,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object('id', v_plan_id, 'amount', 'plan-stale')),
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'id', v_goal_id,
        'target_amount', 'goal-stale',
        'original_target_amount', NULL,
        'initial_amount', NULL
      )),
      '[]'::jsonb,
      'check-stale'
    );
  EXCEPTION WHEN OTHERS THEN
    v_message := SQLERRM;
  END;

  SELECT target_amount INTO v_target
  FROM public.savings_goal WHERE id = v_goal_id;
  SELECT amount INTO v_plan_amount
  FROM public.savings_goal_plan_withdrawal WHERE id = v_plan_id;
  SELECT value INTO v_value
  FROM public.asset_snapshot WHERE id = v_snapshot_id;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_user_id;

  IF v_message IS DISTINCT FROM 'rekey: asset_snapshot holds 1 rows, payload carries 0'
    OR v_target <> 'goal-before'
    OR v_plan_amount <> 'plan-before'
    OR v_value <> 'value-before'
    OR v_key_check <> 'check-before'
  THEN
    RAISE EXCEPTION 'FAIL: a payload missing a snapshot certified a new key (%)', v_message;
  END IF;

  -- A payload of the right length carrying an id that is not the user's
  -- snapshot rewrites nothing, so the row-count assertion must refuse it.
  v_message := NULL;
  BEGIN
    PERFORM public.rekey_user_encrypted_data_with_asset_snapshots(
      v_user_id,
      jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'value', 'value-forged')),
      jsonb_build_array(jsonb_build_object('id', v_plan_id, 'amount', 'plan-forged')),
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'id', v_goal_id,
        'target_amount', 'goal-forged',
        'original_target_amount', NULL,
        'initial_amount', NULL
      )),
      '[]'::jsonb,
      'check-forged'
    );
  EXCEPTION WHEN OTHERS THEN
    v_message := SQLERRM;
  END;

  SELECT target_amount INTO v_target
  FROM public.savings_goal WHERE id = v_goal_id;
  SELECT amount INTO v_plan_amount
  FROM public.savings_goal_plan_withdrawal WHERE id = v_plan_id;
  SELECT value INTO v_value
  FROM public.asset_snapshot WHERE id = v_snapshot_id;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_user_id;

  IF v_message IS DISTINCT FROM 'rekey: asset_snapshot expected 1 rows, got 0'
    OR v_target <> 'goal-before'
    OR v_plan_amount <> 'plan-before'
    OR v_value <> 'value-before'
    OR v_key_check <> 'check-before'
  THEN
    RAISE EXCEPTION 'FAIL: a forged snapshot id certified a new key (%)', v_message;
  END IF;

  PERFORM public.rekey_user_encrypted_data_with_asset_snapshots(
    v_user_id,
    jsonb_build_array(jsonb_build_object('id', v_snapshot_id, 'value', 'value-v3')),
    jsonb_build_array(jsonb_build_object('id', v_plan_id, 'amount', 'plan-v3')),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', v_goal_id,
      'target_amount', 'goal-v3',
      'original_target_amount', NULL,
      'initial_amount', NULL
    )),
    '[]'::jsonb,
    'check-v3'
  );

  SELECT target_amount INTO v_target
  FROM public.savings_goal WHERE id = v_goal_id;
  SELECT amount INTO v_plan_amount
  FROM public.savings_goal_plan_withdrawal WHERE id = v_plan_id;
  SELECT value INTO v_value
  FROM public.asset_snapshot WHERE id = v_snapshot_id;
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_user_id;

  IF v_target <> 'goal-v3'
    OR v_plan_amount <> 'plan-v3'
    OR v_value <> 'value-v3'
    OR v_key_check <> 'check-v3'
  THEN
    RAISE EXCEPTION 'FAIL: v3 rekey did not commit one coherent vault';
  END IF;

  -- A user with no snapshot is untouched by the guard: v1 and v2 still rekey.
  PERFORM public.rekey_user_encrypted_data(
    v_other_user_id, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    '[]'::jsonb, 'check-clean-v1'
  );
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_other_user_id;
  IF v_key_check <> 'check-clean-v1' THEN
    RAISE EXCEPTION 'FAIL: v1 must still rekey a user without snapshots';
  END IF;

  PERFORM public.rekey_user_encrypted_data_with_plan_withdrawals(
    v_other_user_id, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    '[]'::jsonb, '[]'::jsonb, 'check-clean-v2'
  );
  SELECT key_check INTO v_key_check
  FROM public.user_encryption_key WHERE user_id = v_other_user_id;
  IF v_key_check <> 'check-clean-v2' THEN
    RAISE EXCEPTION 'FAIL: v2 must still rekey a user without snapshots';
  END IF;

  RAISE NOTICE 'REKEY ASSET SNAPSHOT ROLLING DEPLOY: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
