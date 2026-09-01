-- PUL-6 — generate a consecutive budget series in one transaction.
-- The caller computes payDay-aware savings-goal exclusions; PostgreSQL owns
-- concurrency, period existence checks and all-or-none materialization.

CREATE OR REPLACE FUNCTION public.generate_budgets_from_template(
  p_user_id uuid,
  p_template_id uuid,
  p_start_month integer,
  p_start_year integer,
  p_count integer DEFAULT 12,
  p_excluded_savings_goal_ids_by_period jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_offset integer;
  v_period_index integer;
  v_month integer;
  v_year integer;
  v_leaf_result jsonb;
  v_created_budget_ids uuid[] := '{}'::uuid[];
  v_skipped_months jsonb := '[]'::jsonb;
  v_excluded_goal_ids uuid[];
BEGIN
  IF p_user_id IS NULL
    OR (
      auth.uid() IS DISTINCT FROM p_user_id
      AND current_user <> 'service_role'
    )
  THEN
    RAISE EXCEPTION 'User access denied';
  END IF;

  IF p_start_month NOT BETWEEN 1 AND 12
    OR p_start_year NOT BETWEEN 2020 AND EXTRACT(YEAR FROM CURRENT_DATE)::integer + 10
    OR p_count NOT BETWEEN 1 AND 36
    OR p_start_year + ((p_start_month - 1 + p_count - 1) / 12)
      > EXTRACT(YEAR FROM CURRENT_DATE)::integer + 10
  THEN
    RAISE EXCEPTION 'Invalid budget generation period';
  END IF;

  IF jsonb_typeof(COALESCE(p_excluded_savings_goal_ids_by_period, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid savings goal exclusions';
  END IF;

  PERFORM 1
  FROM public.template
  WHERE id = p_template_id
    AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('generate_budgets:' || p_user_id::text, 0)
  );

  FOR v_offset IN 0..p_count - 1
  LOOP
    v_period_index := p_start_year * 12 + p_start_month - 1 + v_offset;
    v_year := v_period_index / 12;
    v_month := v_period_index % 12 + 1;

    IF EXISTS (
      SELECT 1
      FROM public.monthly_budget
      WHERE user_id = p_user_id
        AND month = v_month
        AND year = v_year
    ) THEN
      v_skipped_months := v_skipped_months || jsonb_build_array(
        jsonb_build_object('month', v_month, 'year', v_year)
      );
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[])
    INTO v_excluded_goal_ids
    FROM jsonb_array_elements_text(
      COALESCE(
        p_excluded_savings_goal_ids_by_period -> (v_month || '/' || v_year),
        '[]'::jsonb
      )
    ) AS value;

    v_leaf_result := public.create_budget_from_template(
      p_user_id := p_user_id,
      p_template_id := p_template_id,
      p_month := v_month,
      p_year := v_year,
      p_description := 'Budget ' || v_month || '/' || v_year,
      p_excluded_savings_goal_ids := v_excluded_goal_ids
    );
    v_created_budget_ids := array_append(
      v_created_budget_ids,
      (v_leaf_result -> 'budget' ->> 'id')::uuid
    );
  END LOOP;

  RETURN jsonb_build_object(
    'created_budget_ids', to_jsonb(v_created_budget_ids),
    'skipped_months', v_skipped_months
  );
END;
$$;

ALTER FUNCTION public.generate_budgets_from_template(
  uuid, uuid, integer, integer, integer, jsonb
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.generate_budgets_from_template(
  uuid, uuid, integer, integer, integer, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_budgets_from_template(
  uuid, uuid, integer, integer, integer, jsonb
) TO authenticated, service_role;
