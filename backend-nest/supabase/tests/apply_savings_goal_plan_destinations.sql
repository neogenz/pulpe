-- Atomic destination transitions for signed savings-goal plan withdrawals.
--
-- Every call quotes the revision certified at that moment, the way the backend
-- does after its own guard. Rejecting a stale one is proven separately by
-- savings_goal_plan_concurrency.sql.
BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_other_id uuid := gen_random_uuid();
  v_goal_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_saving_line_id uuid := gen_random_uuid();
  v_managed_line_id uuid;
  v_min_index int := 2030 * 12 + 6;
  v_amount text;
  v_count int;
  v_caught boolean;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES
    (v_user_id, 'sg-plan-destination@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_other_id, 'sg-plan-destination-other@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id::text)::text, true);

  INSERT INTO public.savings_goal (id, user_id, name, target_amount, target_date, status)
  VALUES (v_goal_id, v_user_id, 'Maison', 'enc:10000', '2031-06-01', 'ACTIVE');
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_user_id, 'Plan Test', '', false);
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_budget_id, v_user_id, v_template_id, 6, 2030, '');
  INSERT INTO public.budget_line (
    id, budget_id, name, amount, kind, recurrence, savings_goal_id
  ) VALUES (
    v_saving_line_id, v_budget_id, 'Épargne', 'enc:1260', 'saving', 'fixed', v_goal_id
  );

  -- New direct → linked → changed direct → zero: never two representations.
  PERFORM public.apply_savings_goal_plan_with_destinations(
    v_goal_id, v_min_index, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'month', 6, 'year', 2030, 'amount', 'enc:4500', 'destination', 'goal_only'
    )),
    (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
  );
  SELECT amount INTO v_amount FROM public.savings_goal_plan_withdrawal
  WHERE savings_goal_id = v_goal_id AND month = 6 AND year = 2030;
  IF v_amount <> 'enc:4500' THEN RAISE EXCEPTION 'FAIL: direct amount not preserved encrypted'; END IF;

  PERFORM public.apply_savings_goal_plan_with_destinations(
    v_goal_id, v_min_index, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'month', 6, 'year', 2030, 'amount', 'enc:4500-v2', 'destination', 'linked_income'
    )),
    (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
  );
  SELECT count(*) INTO v_count FROM public.savings_goal_plan_withdrawal
  WHERE savings_goal_id = v_goal_id AND month = 6 AND year = 2030;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: linked transition kept direct twin'; END IF;
  SELECT amount INTO v_amount FROM public.budget_line
  WHERE source_savings_goal_id = v_goal_id AND is_savings_goal_plan_adjustment;
  IF v_amount <> 'enc:4500-v2' THEN RAISE EXCEPTION 'FAIL: linked ciphertext not stored'; END IF;

  -- A positive saving edit cannot silently delete a linked withdrawal that
  -- has already been pointed; the whole transition remains unchanged.
  SELECT id INTO v_managed_line_id FROM public.budget_line
  WHERE source_savings_goal_id = v_goal_id AND is_savings_goal_plan_adjustment;
  UPDATE public.budget_line SET checked_at = '2030-06-10T00:00:00Z'
  WHERE id = v_managed_line_id;
  v_caught := false;
  BEGIN
    PERFORM public.apply_savings_goal_plan_with_destinations(
      v_goal_id, v_min_index,
      jsonb_build_array(jsonb_build_object(
        'budget_line_id', v_saving_line_id, 'amount', 'enc:2000'
      )),
      '[]'::jsonb,
      (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  SELECT amount INTO v_amount FROM public.budget_line WHERE id = v_saving_line_id;
  IF NOT v_caught OR v_amount <> 'enc:1260' THEN
    RAISE EXCEPTION 'FAIL: positive edit bypassed realized linked guard';
  END IF;
  UPDATE public.budget_line SET checked_at = NULL WHERE id = v_managed_line_id;

  PERFORM public.apply_savings_goal_plan_with_destinations(
    v_goal_id, v_min_index, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'month', 6, 'year', 2030, 'amount', 'enc:3500', 'destination', 'goal_only'
    )),
    (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
  );
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE source_savings_goal_id = v_goal_id AND is_savings_goal_plan_adjustment;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: direct transition kept linked twin'; END IF;

  PERFORM public.apply_savings_goal_plan_with_destinations(
    v_goal_id, v_min_index, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'month', 6, 'year', 2030, 'amount', NULL, 'destination', 'goal_only'
    )),
    (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
  );
  SELECT count(*) INTO v_count FROM public.savings_goal_plan_withdrawal
  WHERE savings_goal_id = v_goal_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: zero did not delete direct withdrawal'; END IF;

  -- Destination omission remains the legacy goal-only behaviour.
  PERFORM public.apply_savings_goal_plan_with_destinations(
    v_goal_id, v_min_index, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'month', 6, 'year', 2030, 'amount', 'enc:450'
    )),
    (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
  );
  SELECT count(*) INTO v_count FROM public.savings_goal_plan_withdrawal
  WHERE savings_goal_id = v_goal_id AND month = 6 AND year = 2030;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: missing destination lost goal-only compatibility'; END IF;

  PERFORM public.apply_savings_goal_plan_with_destinations(
    v_goal_id, v_min_index, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'month', 6, 'year', 2030, 'amount', NULL
    )),
    (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
  );

  -- A direct RPC caller cannot create both representations for one period.
  v_caught := false;
  BEGIN
    PERFORM public.apply_savings_goal_plan_with_destinations(
      v_goal_id, v_min_index, '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'month', 6, 'year', 2030, 'amount', 'enc:450', 'destination', 'goal_only'
        ),
        jsonb_build_object(
          'month', 6, 'year', 2030, 'amount', 'enc:450', 'destination', 'linked_income'
        )
      ),
      (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  SELECT count(*) INTO v_count FROM (
    SELECT 1 FROM public.savings_goal_plan_withdrawal
    WHERE savings_goal_id = v_goal_id AND month = 6 AND year = 2030
    UNION ALL
    SELECT 1 FROM public.budget_line
    WHERE source_savings_goal_id = v_goal_id AND is_savings_goal_plan_adjustment
  ) representations;
  IF NOT v_caught OR v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: duplicate period created two representations';
  END IF;

  -- Missing budget rejects the whole call, including the saving-line update.
  v_caught := false;
  BEGIN
    PERFORM public.apply_savings_goal_plan_with_destinations(
      v_goal_id, v_min_index,
      jsonb_build_array(jsonb_build_object(
        'budget_line_id', v_saving_line_id, 'amount', 'enc:9999'
      )),
      jsonb_build_array(jsonb_build_object(
        'month', 7, 'year', 2030, 'amount', 'enc:450', 'destination', 'linked_income'
      )),
      (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  SELECT amount INTO v_amount FROM public.budget_line WHERE id = v_saving_line_id;
  IF NOT v_caught OR v_amount <> 'enc:1260' THEN
    RAISE EXCEPTION 'FAIL: missing-budget call was not atomic';
  END IF;

  -- Ownership guard applies before either representation can be touched.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other_id::text)::text, true);
  v_caught := false;
  BEGIN
    PERFORM public.apply_savings_goal_plan_with_destinations(
      v_goal_id, v_min_index, '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'month', 6, 'year', 2030, 'amount', 'enc:450', 'destination', 'goal_only'
      )),
      (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'FAIL: cross-user transition accepted'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id::text)::text, true);

  -- The destination core hands '[]' to the function holding the period guard
  -- and writes the withdrawals itself, so the guard has to live on this entry
  -- point. Only the use case stood between a client and a past period.
  v_caught := false;
  BEGIN
    PERFORM public.apply_savings_goal_plan_with_destinations(
      v_goal_id, v_min_index, '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'month', 1, 'year', 2020, 'amount', 'enc:450', 'destination', 'goal_only'
      )),
      (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  SELECT count(*) INTO v_count FROM public.savings_goal_plan_withdrawal
  WHERE savings_goal_id = v_goal_id AND month = 1 AND year = 2020;
  IF NOT v_caught OR v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: a past period was written through the destination RPC';
  END IF;

  -- budget_line_plan_adjustment_shape demands source_savings_goal_id, and the
  -- foreign key nulls it when the goal goes. Without an expiring marker the
  -- final DELETE of every deletion mode raised 23514, and the goal could not be
  -- deleted at all. The forecast survives as the user's own broken-link income.
  PERFORM public.apply_savings_goal_plan_with_destinations(
    v_goal_id, v_min_index, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'month', 6, 'year', 2030, 'amount', 'enc:4500-final', 'destination', 'linked_income'
    )),
    (SELECT balance_revision FROM public.savings_goal WHERE id = v_goal_id)
  );
  SELECT id INTO v_managed_line_id FROM public.budget_line
  WHERE source_savings_goal_id = v_goal_id AND is_savings_goal_plan_adjustment;
  IF v_managed_line_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: no linked representation to outlive the goal';
  END IF;

  -- The marker must expire on what the row becomes, not on what a BEFORE
  -- trigger sees mid-flight. enforce_savings_goal_line_link nulls
  -- savings_goal_id for a non-saving line, so this PATCH stores a row identical
  -- to the one above. Losing the marker here would hide the representation from
  -- the plan's own period DELETE and from its unique index, and the next write
  -- for that period would add a second income forecast for one withdrawal.
  UPDATE public.budget_line SET savings_goal_id = v_goal_id
  WHERE id = v_managed_line_id;
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE id = v_managed_line_id
    AND is_savings_goal_plan_adjustment
    AND savings_goal_id IS NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: a write that changed nothing destroyed the marker';
  END IF;

  DELETE FROM public.savings_goal WHERE id = v_goal_id;

  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE id = v_managed_line_id
    AND NOT is_savings_goal_plan_adjustment
    AND source_savings_goal_id IS NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: the marker outlived the shape it asserts';
  END IF;

  RAISE NOTICE 'APPLY SAVINGS GOAL PLAN DESTINATIONS: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
