-- pulpe:migration-phase contract
-- pulpe:safe-after v0.60.0
-- Spread: create the budgets of several periods in one transaction.
--
-- Spreading an expense over months that have no budget yet called
-- create_budget_from_template once per month, one HTTP round trip each, and
-- had to do so one after another: concurrent copies for one user deadlock on
-- the savings_goal rows bumped by the budget_line revision trigger. The loop
-- now runs here. Unlike generate_budgets_from_template the periods need not be
-- consecutive, an existing period is an error rather than a skip, and the
-- created rows come back so the caller does not re-read them. All periods land
-- or none does. Invoker rights: RLS and the leaf function still decide what
-- the caller may write. Contract, like the leaf it calls: the grant is required.

CREATE OR REPLACE FUNCTION public.create_budgets_from_template(
  p_user_id uuid,
  p_template_id uuid,
  p_periods jsonb,
  p_excluded_savings_goal_ids_by_period jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_period record;
  v_excluded_goal_ids uuid[];
  v_leaf_result jsonb;
  v_budgets jsonb := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL
    OR (
      auth.uid() IS DISTINCT FROM p_user_id
      AND current_user <> 'service_role'
    )
  THEN
    RAISE EXCEPTION 'User access denied';
  END IF;

  IF jsonb_typeof(p_periods) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_periods) NOT BETWEEN 1 AND 36
  THEN
    RAISE EXCEPTION 'Invalid budget periods';
  END IF;

  IF jsonb_typeof(COALESCE(p_excluded_savings_goal_ids_by_period, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid savings goal exclusions';
  END IF;

  -- Same key as generate_budgets_from_template: both materialize a user's
  -- months, so they wait for each other instead of racing on a period.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('generate_budgets:' || p_user_id::text, 0)
  );

  FOR v_period IN
    SELECT
      (period ->> 'month')::integer AS month,
      (period ->> 'year')::integer AS year,
      period ->> 'description' AS description
    FROM jsonb_array_elements(p_periods) WITH ORDINALITY AS t(period, position)
    ORDER BY position
  LOOP
    SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[])
    INTO v_excluded_goal_ids
    FROM jsonb_array_elements_text(
      COALESCE(
        p_excluded_savings_goal_ids_by_period
          -> (v_period.month || '/' || v_period.year),
        '[]'::jsonb
      )
    ) AS value;

    v_leaf_result := public.create_budget_from_template(
      p_user_id := p_user_id,
      p_template_id := p_template_id,
      p_month := v_period.month,
      p_year := v_period.year,
      p_description := v_period.description,
      p_excluded_savings_goal_ids := v_excluded_goal_ids
    );
    v_budgets := v_budgets || jsonb_build_array(v_leaf_result -> 'budget');
  END LOOP;

  RETURN jsonb_build_object('budgets', v_budgets);
END;
$$;

ALTER FUNCTION public.create_budgets_from_template(
  uuid, uuid, jsonb, jsonb
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_budgets_from_template(
  uuid, uuid, jsonb, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_budgets_from_template(
  uuid, uuid, jsonb, jsonb
) TO authenticated, service_role;
