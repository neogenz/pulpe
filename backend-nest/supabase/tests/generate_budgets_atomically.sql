BEGIN;

CREATE FUNCTION public.fail_late_budget_generation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.month = 5 AND NEW.year = 2026 THEN
    RAISE EXCEPTION 'late generation failure';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fail_late_budget_generation
BEFORE INSERT ON public.monthly_budget
FOR EACH ROW EXECUTE FUNCTION public.fail_late_budget_generation();

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_other_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_other_template_id uuid := gen_random_uuid();
  v_goal_id uuid := gen_random_uuid();
  v_result jsonb;
  v_created_ids uuid[];
  v_caught boolean;
  v_definition text;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES
    (v_owner_id, 'generate-owner@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_other_id, 'generate-other@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES
    (v_template_id, v_owner_id, 'Owner Template', '', false),
    (v_other_template_id, v_other_id, 'Other Template', '', false);

  INSERT INTO public.savings_goal (
    id, user_id, name, target_amount, start_date, target_date, status
  ) VALUES (
    v_goal_id, v_owner_id, 'Goal', 'ciphertext', '2026-01-01', '2026-12-31', 'ACTIVE'
  );

  INSERT INTO public.template_line (
    template_id, name, amount, kind, recurrence, savings_goal_id
  ) VALUES
    (v_template_id, 'Salary', 'ciphertext', 'income', 'fixed', NULL),
    (v_template_id, 'Goal', 'ciphertext', 'saving', 'fixed', v_goal_id),
    (v_other_template_id, 'Salary', 'ciphertext', 'income', 'fixed', NULL);

  INSERT INTO public.monthly_budget (
    user_id, template_id, month, year, description
  ) VALUES (v_owner_id, v_template_id, 2, 2026, 'Existing');

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner_id::text)::text,
    true
  );

  v_result := public.generate_budgets_from_template(
    p_user_id := v_owner_id,
    p_template_id := v_template_id,
    p_start_month := 1,
    p_start_year := 2026,
    p_count := 3,
    p_excluded_savings_goal_ids_by_period := jsonb_build_object(
      '3/2026', jsonb_build_array(v_goal_id)
    )
  );

  SELECT array_agg(value::uuid)
  INTO v_created_ids
  FROM jsonb_array_elements_text(v_result -> 'created_budget_ids') AS value;

  IF cardinality(v_created_ids) <> 2
    OR (v_result -> 'skipped_months') <> '[{"month": 2, "year": 2026}]'::jsonb
  THEN
    RAISE EXCEPTION 'FAIL: unexpected generation result %', v_result;
  END IF;

  IF (
    SELECT array_agg(month ORDER BY array_position(v_created_ids, id))
    FROM public.monthly_budget
    WHERE id = ANY(v_created_ids)
  ) IS DISTINCT FROM ARRAY[1, 3]
  THEN
    RAISE EXCEPTION 'FAIL: created ids are not chronological';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.budget_line bl
    JOIN public.monthly_budget mb ON mb.id = bl.budget_id
    WHERE mb.user_id = v_owner_id
      AND mb.month = 1
      AND bl.savings_goal_id = v_goal_id
  ) OR EXISTS (
    SELECT 1
    FROM public.budget_line bl
    JOIN public.monthly_budget mb ON mb.id = bl.budget_id
    WHERE mb.user_id = v_owner_id
      AND mb.month = 3
      AND bl.savings_goal_id = v_goal_id
  ) THEN
    RAISE EXCEPTION 'FAIL: per-period savings goal exclusions were not forwarded';
  END IF;

  v_caught := false;
  BEGIN
    PERFORM public.generate_budgets_from_template(
      v_other_id, v_other_template_id, 1, 2026, 1, '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL: cross-user generation was accepted';
  END IF;

  v_caught := false;
  BEGIN
    PERFORM public.generate_budgets_from_template(
      v_owner_id, v_template_id, 4, 2026, 2, '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL: late error was not raised';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.monthly_budget
    WHERE user_id = v_owner_id AND year = 2026 AND month IN (4, 5)
  ) THEN
    RAISE EXCEPTION 'FAIL: a partial generation survived rollback';
  END IF;

  SELECT pg_get_functiondef(
    'public.generate_budgets_from_template(uuid,uuid,integer,integer,integer,jsonb)'::regprocedure
  ) INTO v_definition;
  IF position('pg_advisory_xact_lock' in v_definition) = 0 THEN
    RAISE EXCEPTION 'FAIL: generation is not serialized per user';
  END IF;

  RAISE NOTICE 'GENERATE BUDGETS ATOMICALLY: ALL ASSERTIONS PASSED';
END;
$$;

ROLLBACK;
