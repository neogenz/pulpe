-- Regression test for the enforce_transaction_budget_line_link trigger
-- (20260723120000). A transaction whose budget_line_id points to a line of a
-- DIFFERENT budget corrupts envelope consumption math and lets
-- check_unchecked_transactions mutate lines outside the transaction's budget.
-- Mirror of the savings_goal_id guard proven by 20260701083300.
-- Wraps in a transaction and rolls back at the end so DB state is unaffected.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_budget_a_id uuid := gen_random_uuid();
  v_budget_b_id uuid := gen_random_uuid();
  v_line_in_b_id uuid := gen_random_uuid();
  v_txn_id uuid := gen_random_uuid();
  v_caught boolean;
BEGIN
  -- Authenticated context for the test user.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_id::text)::text,
    true
  );

  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES (v_user_id, 'txn-line-coherence@local.test', 'fake',
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_user_id, 'Coherence Template', 'coherence test', false);

  -- Two budgets of the SAME user — RLS cannot catch a cross-budget link.
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES
    (v_budget_a_id, v_user_id, v_template_id, 1, 2025, 'Budget A'),
    (v_budget_b_id, v_user_id, v_template_id, 2, 2025, 'Budget B');

  -- A budget line living in budget B.
  INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence)
  VALUES (v_line_in_b_id, v_budget_b_id, 'Courses', 'CIPHERTEXT_100',
          'expense'::public.transaction_kind, 'one_off'::public.transaction_recurrence);

  ----------------------------------------------------------------------
  -- ASSERTION 1: INSERT into budget A linked to a line of budget B → rejected
  ----------------------------------------------------------------------
  v_caught := false;
  BEGIN
    INSERT INTO public.transaction (id, budget_id, budget_line_id, name, amount, kind, transaction_date)
    VALUES (gen_random_uuid(), v_budget_a_id, v_line_in_b_id, 'Cross-budget link',
            'CIPHERTEXT_50', 'expense'::public.transaction_kind, '2025-01-15');
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL [1]: cross-budget budget_line_id INSERT was accepted';
  END IF;
  RAISE NOTICE 'PASS [1] cross-budget INSERT rejected';

  ----------------------------------------------------------------------
  -- ASSERTION 2: coherent link (same budget) → accepted
  ----------------------------------------------------------------------
  INSERT INTO public.transaction (id, budget_id, budget_line_id, name, amount, kind, transaction_date)
  VALUES (v_txn_id, v_budget_b_id, v_line_in_b_id, 'Coherent link',
          'CIPHERTEXT_50', 'expense'::public.transaction_kind, '2025-02-15');
  RAISE NOTICE 'PASS [2] same-budget INSERT accepted';

  ----------------------------------------------------------------------
  -- ASSERTION 3: NULL budget_line_id (free transaction) → accepted
  ----------------------------------------------------------------------
  INSERT INTO public.transaction (id, budget_id, budget_line_id, name, amount, kind, transaction_date)
  VALUES (gen_random_uuid(), v_budget_a_id, NULL, 'Free transaction',
          'CIPHERTEXT_20', 'expense'::public.transaction_kind, '2025-01-20');
  RAISE NOTICE 'PASS [3] free transaction accepted';

  ----------------------------------------------------------------------
  -- ASSERTION 4: UPDATE relinking to a cross-budget line → rejected
  ----------------------------------------------------------------------
  v_caught := false;
  BEGIN
    UPDATE public.transaction
    SET budget_id = v_budget_a_id
    WHERE id = v_txn_id;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL [4]: UPDATE moving an allocated transaction to another budget was accepted';
  END IF;
  RAISE NOTICE 'PASS [4] cross-budget UPDATE rejected';

  RAISE NOTICE 'ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
