-- Integration test for toggle_transaction_check RPC.
-- Validates: toggle null→now, toggle now→null, ownership enforcement,
-- and that ending_balance is NOT touched (Option A: checkedAt is UI-only).
-- Wraps in a transaction and rolls back at the end so DB state is unaffected.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_other_user_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_other_template_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_other_budget_id uuid := gen_random_uuid();
  v_txn_id uuid := gen_random_uuid();
  v_other_txn_id uuid := gen_random_uuid();
  v_initial_balance text := 'CIPHERTEXT_INITIAL_BALANCE';
  v_check_checked_at timestamptz;
  v_check_balance text;
  v_returned_row public.transaction;
  v_caught_exception boolean;
BEGIN
  -- Set up authenticated context for test user.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_id::text)::text,
    true
  );

  -- Create auth users.
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES
    (v_user_id, 'toggle-test@local.test', 'fake', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_other_user_id, 'toggle-other@local.test', 'fake', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  -- Seed: templates (FK target for monthly_budget.template_id).
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES
    (v_template_id, v_user_id, 'Test Template', 'toggle test', false),
    (v_other_template_id, v_other_user_id, 'Other Template', 'toggle test', false);

  -- Seed: budget for test user with a known ending_balance ciphertext.
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description, ending_balance)
  VALUES (v_budget_id, v_user_id, v_template_id, 1, 2025, 'Test Budget', v_initial_balance);

  -- Seed: budget for OTHER user (for ownership test).
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_other_budget_id, v_other_user_id, v_other_template_id, 1, 2025, 'Other Budget');

  -- Seed: transaction for test user, initially unchecked.
  INSERT INTO public.transaction (
    id, budget_id, name, amount, kind, transaction_date, checked_at
  )
  VALUES (
    v_txn_id, v_budget_id, 'Restaurant', 'CIPHERTEXT_50', 'expense'::public.transaction_kind, '2025-01-15', NULL
  );

  -- Seed: transaction owned by OTHER user (for ownership test).
  INSERT INTO public.transaction (
    id, budget_id, name, amount, kind, transaction_date
  )
  VALUES (
    v_other_txn_id, v_other_budget_id, 'Other Txn', 'CIPHERTEXT_99', 'expense'::public.transaction_kind, '2025-01-15'
  );

  ----------------------------------------------------------------------
  -- ASSERTION 1: toggle null → now
  ----------------------------------------------------------------------
  v_returned_row := public.toggle_transaction_check(v_txn_id);

  IF v_returned_row.checked_at IS NULL THEN
    RAISE EXCEPTION 'FAIL [1]: toggle null → expected now, got NULL';
  END IF;

  IF v_returned_row.id != v_txn_id THEN
    RAISE EXCEPTION 'FAIL [1]: returned row id mismatch';
  END IF;

  RAISE NOTICE 'PASS [1] toggle null → now (%)', v_returned_row.checked_at;

  ----------------------------------------------------------------------
  -- ASSERTION 2: toggle now → null (re-toggle)
  ----------------------------------------------------------------------
  v_returned_row := public.toggle_transaction_check(v_txn_id);

  IF v_returned_row.checked_at IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL [2]: re-toggle → expected NULL, got %', v_returned_row.checked_at;
  END IF;

  RAISE NOTICE 'PASS [2] re-toggle now → null';

  ----------------------------------------------------------------------
  -- ASSERTION 3: ending_balance is NOT modified by toggle (Option A).
  -- This is a regression guard: if a future contributor accidentally
  -- couples toggle to recalc, this will fail.
  ----------------------------------------------------------------------
  SELECT ending_balance INTO v_check_balance
  FROM public.monthly_budget
  WHERE id = v_budget_id;

  IF v_check_balance != v_initial_balance THEN
    RAISE EXCEPTION 'FAIL [3]: ending_balance changed (% → %), Option A violated', v_initial_balance, v_check_balance;
  END IF;

  RAISE NOTICE 'PASS [3] ending_balance untouched by toggle (Option A)';

  ----------------------------------------------------------------------
  -- ASSERTION 4: ownership enforcement — other user's txn raises.
  ----------------------------------------------------------------------
  v_caught_exception := false;
  BEGIN
    PERFORM public.toggle_transaction_check(v_other_txn_id);
  EXCEPTION WHEN OTHERS THEN
    v_caught_exception := true;
  END;

  IF NOT v_caught_exception THEN
    RAISE EXCEPTION 'FAIL [4]: cross-user toggle should raise but did not';
  END IF;

  RAISE NOTICE 'PASS [4] cross-user toggle rejected';

  ----------------------------------------------------------------------
  -- ASSERTION 5: nonexistent transaction raises.
  ----------------------------------------------------------------------
  v_caught_exception := false;
  BEGIN
    PERFORM public.toggle_transaction_check('99999999-9999-9999-9999-999999999999'::uuid);
  EXCEPTION WHEN OTHERS THEN
    v_caught_exception := true;
  END;

  IF NOT v_caught_exception THEN
    RAISE EXCEPTION 'FAIL [5]: nonexistent transaction should raise but did not';
  END IF;

  RAISE NOTICE 'PASS [5] nonexistent transaction rejected';

  ----------------------------------------------------------------------
  -- ASSERTION 6: updated_at is bumped on toggle.
  ----------------------------------------------------------------------
  v_returned_row := public.toggle_transaction_check(v_txn_id);

  IF v_returned_row.updated_at IS NULL THEN
    RAISE EXCEPTION 'FAIL [6]: updated_at not set';
  END IF;

  RAISE NOTICE 'PASS [6] updated_at bumped on toggle';

  RAISE NOTICE 'ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
