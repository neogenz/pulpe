-- PUL-12 — keep plan application line-scoped and FX-coherent.
--
-- Missing monthly budgets are provisioned before this RPC. The RPC therefore
-- only updates concrete budget lines and no longer mutates template lines.
-- Changing the encrypted target amount invalidates any source-currency amount
-- and rate; target_currency remains the budget's display currency.

DROP FUNCTION IF EXISTS public.apply_savings_goal_plan(uuid, int, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.apply_savings_goal_plan(
  p_goal_id uuid,
  p_min_period_index int,
  p_line_updates jsonb DEFAULT '[]'::jsonb
) RETURNS SETOF public.budget_line
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_updated_ids uuid[];
  v_line_count integer;
  v_expected_line_count integer := jsonb_array_length(p_line_updates);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('apply_savings_goal_plan'),
    hashtext(p_goal_id::text)
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.savings_goal
    WHERE id = p_goal_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  WITH updated AS (
    UPDATE public.budget_line bl
    SET amount = u.amount,
        original_amount = NULL,
        original_currency = NULL,
        exchange_rate = NULL,
        is_manually_adjusted = true,
        updated_at = NOW()
    FROM jsonb_to_recordset(p_line_updates)
      AS u(budget_line_id uuid, amount text),
      public.monthly_budget mb
    WHERE bl.id = u.budget_line_id
      AND mb.id = bl.budget_id
      AND mb.user_id = v_uid
      AND bl.savings_goal_id = p_goal_id
      AND bl.kind = 'saving'::public.transaction_kind
      AND bl.checked_at IS NULL
      AND (mb.year * 12 + mb.month) >= p_min_period_index
    RETURNING bl.id
  )
  SELECT array_agg(id) INTO v_updated_ids FROM updated;

  v_line_count := COALESCE(array_length(v_updated_ids, 1), 0);

  IF v_line_count <> v_expected_line_count THEN
    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_line_updates) AS u(budget_line_id uuid, amount text)
      LEFT JOIN public.budget_line bl
        ON bl.id = u.budget_line_id
        AND bl.savings_goal_id = p_goal_id
        AND bl.kind = 'saving'::public.transaction_kind
      LEFT JOIN public.monthly_budget mb
        ON mb.id = bl.budget_id AND mb.user_id = v_uid
      WHERE bl.id IS NULL OR mb.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Plan line not linked' USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_line_updates) AS u(budget_line_id uuid, amount text)
      JOIN public.budget_line bl ON bl.id = u.budget_line_id
      JOIN public.monthly_budget mb ON mb.id = bl.budget_id AND mb.user_id = v_uid
      WHERE bl.savings_goal_id = p_goal_id
        AND bl.kind = 'saving'::public.transaction_kind
        AND bl.checked_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Plan line already checked' USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_line_updates) AS u(budget_line_id uuid, amount text)
      JOIN public.budget_line bl ON bl.id = u.budget_line_id
      JOIN public.monthly_budget mb ON mb.id = bl.budget_id AND mb.user_id = v_uid
      WHERE bl.savings_goal_id = p_goal_id
        AND bl.kind = 'saving'::public.transaction_kind
        AND (mb.year * 12 + mb.month) < p_min_period_index
    ) THEN
      RAISE EXCEPTION 'Plan line in past period' USING ERRCODE = 'P0001';
    END IF;

    RAISE EXCEPTION 'Plan line not linked' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT bl.* FROM public.budget_line bl
  WHERE bl.id = ANY(v_updated_ids);
END;
$$;

ALTER FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb)
  OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb)
  TO authenticated, service_role;

-- A later budget-line-tags migration replaced this RPC after the original
-- savings-goal propagation migration. Preserve both contracts when missing
-- monthly budgets are materialized from the template.
CREATE OR REPLACE FUNCTION public.create_budget_from_template(
  p_user_id uuid,
  p_template_id uuid,
  p_month integer,
  p_year integer,
  p_description text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  new_budget_id uuid;
  new_budget_line_id uuid;
  template_record record;
  template_line_record record;
  budget_line_count integer := 0;
BEGIN
  SELECT id, user_id, name INTO template_record
  FROM public.template
  WHERE id = p_template_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.monthly_budget
    WHERE user_id = p_user_id
      AND month = p_month
      AND year = p_year
  ) THEN
    RAISE EXCEPTION 'Budget already exists for this period';
  END IF;

  INSERT INTO public.monthly_budget (user_id, template_id, month, year, description)
  VALUES (p_user_id, p_template_id, p_month, p_year, p_description)
  RETURNING id INTO new_budget_id;

  FOR template_line_record IN
    SELECT tl.id, tl.amount, tl.kind, tl.recurrence, tl.name, tl.description,
           tl.savings_goal_id,
           tl.original_amount, tl.original_currency, tl.target_currency, tl.exchange_rate
    FROM public.template_line tl
    WHERE tl.template_id = p_template_id
    ORDER BY tl.created_at
  LOOP
    INSERT INTO public.budget_line (
      budget_id, template_line_id, amount, kind, recurrence, name, savings_goal_id,
      original_amount, original_currency, target_currency, exchange_rate
    ) VALUES (
      new_budget_id,
      template_line_record.id,
      template_line_record.amount,
      template_line_record.kind,
      template_line_record.recurrence,
      template_line_record.name,
      template_line_record.savings_goal_id,
      template_line_record.original_amount,
      template_line_record.original_currency,
      template_line_record.target_currency,
      template_line_record.exchange_rate
    )
    RETURNING id INTO new_budget_line_id;

    INSERT INTO public.budget_line_tag (budget_line_id, tag_id)
    SELECT new_budget_line_id, tlt.tag_id
    FROM public.template_line_tag tlt
    WHERE tlt.template_line_id = template_line_record.id;

    budget_line_count := budget_line_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'budget', (
      SELECT to_jsonb(b.*)
      FROM public.monthly_budget b
      WHERE b.id = new_budget_id
    ),
    'budget_lines_created', budget_line_count,
    'template_name', template_record.name
  );
END;
$$;

ALTER FUNCTION public.create_budget_from_template(uuid, uuid, integer, integer, text)
  OWNER TO postgres;
