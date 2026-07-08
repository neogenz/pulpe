-- Regression test for PUL-12 apply_savings_goal_plan guards.
-- Pins the exact P0001 messages the repository matches (SQL→TS contract) and the
-- all-or-nothing guarantee: a single failing line rolls back the whole batch.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_other_id uuid := gen_random_uuid();
  v_goal_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_template_line_id uuid := gen_random_uuid();
  v_past_budget uuid := gen_random_uuid();
  v_current_budget uuid := gen_random_uuid();
  v_future_budget uuid := gen_random_uuid();
  v_current_line uuid := gen_random_uuid();
  v_future_line uuid := gen_random_uuid();
  v_checked_line uuid := gen_random_uuid();
  v_past_line uuid := gen_random_uuid();
  v_unlinked_line uuid := gen_random_uuid();
  -- Fixed test cycles so the period math is deterministic.
  v_min_index int := 2030 * 12 + 6;   -- current cycle = 2030-06
  v_caught boolean;
  v_errmsg text;
  v_amount text;
  v_flag boolean;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES
    (v_user_id, 'sg-plan-owner@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_other_id, 'sg-plan-other@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_id::text)::text,
    true
  );

  INSERT INTO public.savings_goal (id, user_id, name, target_amount, target_date, status)
  VALUES (v_goal_id, v_user_id, 'Maison', 'enc:10000', '2031-06-01', 'ACTIVE');

  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_user_id, 'Plan Test', '', false);

  INSERT INTO public.template_line (id, template_id, name, amount, kind, recurrence, savings_goal_id)
  VALUES (v_template_line_id, v_template_id, 'Épargne MT', 'enc:250', 'saving', 'fixed', v_goal_id);

  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES
    (v_past_budget, v_user_id, v_template_id, 5, 2030, ''),
    (v_current_budget, v_user_id, v_template_id, 6, 2030, ''),
    (v_future_budget, v_user_id, v_template_id, 7, 2030, '');

  INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence, savings_goal_id, checked_at)
  VALUES
    (v_current_line, v_current_budget, 'Courant', 'enc:300', 'saving', 'fixed', v_goal_id, NULL),
    (v_future_line, v_future_budget, 'Futur', 'enc:400', 'saving', 'fixed', v_goal_id, NULL),
    (v_checked_line, v_current_budget, 'Pointée', 'enc:100', 'saving', 'fixed', v_goal_id, '2030-06-10T00:00:00Z'),
    (v_past_line, v_past_budget, 'Passé', 'enc:200', 'saving', 'fixed', v_goal_id, NULL),
    (v_unlinked_line, v_current_budget, 'Libre', 'enc:5000', 'saving', 'fixed', NULL, NULL);

  -- 1. Happy path: current + future lines updated, flagged; template updated.
  PERFORM public.apply_savings_goal_plan(
    p_goal_id := v_goal_id,
    p_min_period_index := v_min_index,
    p_line_updates := jsonb_build_array(
      jsonb_build_object('budget_line_id', v_current_line, 'amount', 'enc:450'),
      jsonb_build_object('budget_line_id', v_future_line, 'amount', 'enc:350')
    ),
    p_template_updates := jsonb_build_array(
      jsonb_build_object('template_line_id', v_template_line_id, 'amount', 'enc:275')
    )
  );

  SELECT amount, is_manually_adjusted INTO v_amount, v_flag
  FROM public.budget_line WHERE id = v_current_line;
  IF v_amount <> 'enc:450' OR v_flag <> true THEN
    RAISE EXCEPTION 'FAIL: current line not updated/flagged (amount=%, flag=%)', v_amount, v_flag;
  END IF;

  SELECT amount INTO v_amount FROM public.template_line WHERE id = v_template_line_id;
  IF v_amount <> 'enc:275' THEN
    RAISE EXCEPTION 'FAIL: template line not updated (amount=%)', v_amount;
  END IF;

  -- 2. Checked line in the batch → RAISE + whole-batch rollback (valid sibling intact).
  v_caught := false;
  BEGIN
    PERFORM public.apply_savings_goal_plan(
      p_goal_id := v_goal_id,
      p_min_period_index := v_min_index,
      p_line_updates := jsonb_build_array(
        jsonb_build_object('budget_line_id', v_current_line, 'amount', 'enc:111'),
        jsonb_build_object('budget_line_id', v_checked_line, 'amount', 'enc:111')
      ),
      p_template_updates := '[]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_errmsg := SQLERRM;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL: checked line in batch did not raise';
  END IF;
  IF v_errmsg NOT LIKE '%Plan line already checked%' THEN
    RAISE EXCEPTION 'FAIL: expected "Plan line already checked", got %', v_errmsg;
  END IF;
  SELECT amount INTO v_amount FROM public.budget_line WHERE id = v_current_line;
  IF v_amount <> 'enc:450' THEN
    RAISE EXCEPTION 'FAIL: batch was partially applied (current line = %)', v_amount;
  END IF;

  -- 3. Past-cycle line → RAISE 'Plan line in past period'.
  v_caught := false;
  BEGIN
    PERFORM public.apply_savings_goal_plan(
      p_goal_id := v_goal_id,
      p_min_period_index := v_min_index,
      p_line_updates := jsonb_build_array(
        jsonb_build_object('budget_line_id', v_past_line, 'amount', 'enc:123')
      ),
      p_template_updates := '[]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_errmsg := SQLERRM;
  END;
  IF NOT v_caught OR v_errmsg NOT LIKE '%Plan line in past period%' THEN
    RAISE EXCEPTION 'FAIL: expected "Plan line in past period", got % (caught=%)', v_errmsg, v_caught;
  END IF;

  -- 4. Unlinked saving line → RAISE 'Plan line not linked'.
  v_caught := false;
  BEGIN
    PERFORM public.apply_savings_goal_plan(
      p_goal_id := v_goal_id,
      p_min_period_index := v_min_index,
      p_line_updates := jsonb_build_array(
        jsonb_build_object('budget_line_id', v_unlinked_line, 'amount', 'enc:123')
      ),
      p_template_updates := '[]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_errmsg := SQLERRM;
  END;
  IF NOT v_caught OR v_errmsg NOT LIKE '%Plan line not linked%' THEN
    RAISE EXCEPTION 'FAIL: expected "Plan line not linked", got % (caught=%)', v_errmsg, v_caught;
  END IF;

  -- 5. Foreign template line → RAISE 'Plan template line not linked'.
  v_caught := false;
  BEGIN
    PERFORM public.apply_savings_goal_plan(
      p_goal_id := v_goal_id,
      p_min_period_index := v_min_index,
      p_line_updates := '[]'::jsonb,
      p_template_updates := jsonb_build_array(
        jsonb_build_object('template_line_id', gen_random_uuid(), 'amount', 'enc:99')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_errmsg := SQLERRM;
  END;
  IF NOT v_caught OR v_errmsg NOT LIKE '%Plan template line not linked%' THEN
    RAISE EXCEPTION 'FAIL: expected "Plan template line not linked", got % (caught=%)', v_errmsg, v_caught;
  END IF;

  -- 6. Cross-user IDOR: another user applying to this goal → 'Savings goal access denied'.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_other_id::text)::text,
    true
  );
  v_caught := false;
  BEGIN
    PERFORM public.apply_savings_goal_plan(
      p_goal_id := v_goal_id,
      p_min_period_index := v_min_index,
      p_line_updates := jsonb_build_array(
        jsonb_build_object('budget_line_id', v_current_line, 'amount', 'enc:999')
      ),
      p_template_updates := '[]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    v_errmsg := SQLERRM;
  END;
  IF NOT v_caught OR v_errmsg NOT LIKE '%Savings goal access denied%' THEN
    RAISE EXCEPTION 'FAIL: expected "Savings goal access denied", got % (caught=%)', v_errmsg, v_caught;
  END IF;
  SELECT amount INTO v_amount FROM public.budget_line WHERE id = v_current_line;
  IF v_amount <> 'enc:450' THEN
    RAISE EXCEPTION 'FAIL: cross-user apply mutated the line (amount = %)', v_amount;
  END IF;

  RAISE NOTICE 'APPLY SAVINGS GOAL PLAN GUARDS: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
