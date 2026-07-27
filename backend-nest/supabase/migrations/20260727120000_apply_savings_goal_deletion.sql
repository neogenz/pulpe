-- PUL-319 — preview and atomically apply a savings-goal deletion decision.
--
-- Financial amounts remain encrypted. The read RPC returns ciphertexts to the
-- authenticated Nest repository, which owns decryption. The write RPC locks
-- the goal and every entity represented by the preview revision before
-- comparing it, so consent can never be applied to a different impact.

CREATE OR REPLACE FUNCTION public.get_savings_goal_deletion_impact(
  p_goal_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.savings_goal
    WHERE id = p_goal_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'goalId', p_goal_id,
    'templateLines', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'lineId', tl.id,
          'templateId', t.id,
          'templateName', t.name,
          'name', tl.name,
          'amount', tl.amount,
          'recurrence', tl.recurrence,
          'updatedAt', tl.updated_at
        )
        ORDER BY t.name, tl.name, tl.id
      )
      FROM public.template_line tl
      JOIN public.template t ON t.id = tl.template_id
      WHERE tl.savings_goal_id = p_goal_id
        AND t.user_id = v_uid
    ), '[]'::jsonb),
    'budgets', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'budgetId', grouped_budget.budget_id,
          'month', grouped_budget.month,
          'year', grouped_budget.year,
          'lines', grouped_budget.lines
        )
        ORDER BY grouped_budget.year, grouped_budget.month, grouped_budget.budget_id
      )
      FROM (
        SELECT
          mb.id AS budget_id,
          mb.month,
          mb.year,
          jsonb_agg(
            jsonb_build_object(
              'lineId', bl.id,
              'name', bl.name,
              'amount', bl.amount,
              'recurrence', bl.recurrence,
              'checkedAt', bl.checked_at,
              'updatedAt', bl.updated_at,
              'transactions', COALESCE((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', tx.id,
                    'budgetId', tx.budget_id,
                    'budgetLineId', tx.budget_line_id,
                    'name', tx.name,
                    'amount', tx.amount,
                    'kind', tx.kind,
                    'transactionDate', tx.transaction_date,
                    'checkedAt', tx.checked_at,
                    'createdAt', tx.created_at,
                    'updatedAt', tx.updated_at,
                    'originalAmount', tx.original_amount,
                    'originalCurrency', tx.original_currency,
                    'targetCurrency', tx.target_currency,
                    'exchangeRate', tx.exchange_rate
                  )
                  ORDER BY tx.transaction_date DESC, tx.id
                )
                FROM public.transaction tx
                WHERE tx.budget_line_id = bl.id
              ), '[]'::jsonb)
            )
            ORDER BY bl.name, bl.id
          ) AS lines
        FROM public.budget_line bl
        JOIN public.monthly_budget mb ON mb.id = bl.budget_id
        WHERE bl.savings_goal_id = p_goal_id
          AND mb.user_id = v_uid
        GROUP BY mb.id, mb.month, mb.year
      ) grouped_budget
    ), '[]'::jsonb),
    'revision', jsonb_build_object(
      'templateLines', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', tl.id, 'updatedAt', tl.updated_at)
          ORDER BY tl.id
        )
        FROM public.template_line tl
        JOIN public.template t ON t.id = tl.template_id
        WHERE tl.savings_goal_id = p_goal_id
          AND t.user_id = v_uid
      ), '[]'::jsonb),
      'budgetLines', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', bl.id, 'updatedAt', bl.updated_at)
          ORDER BY bl.id
        )
        FROM public.budget_line bl
        JOIN public.monthly_budget mb ON mb.id = bl.budget_id
        WHERE bl.savings_goal_id = p_goal_id
          AND mb.user_id = v_uid
      ), '[]'::jsonb),
      'transactions', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', tx.id, 'updatedAt', tx.updated_at)
          ORDER BY tx.id
        )
        FROM public.transaction tx
        JOIN public.budget_line bl ON bl.id = tx.budget_line_id
        JOIN public.monthly_budget mb ON mb.id = bl.budget_id
        WHERE bl.savings_goal_id = p_goal_id
          AND mb.user_id = v_uid
      ), '[]'::jsonb)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_savings_goal_deletion(
  p_goal_id uuid,
  p_mode text,
  p_revision jsonb
) RETURNS TABLE (budget_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_current_revision jsonb;
  v_budget_ids uuid[] := '{}'::uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode NOT IN (
    'goal_only',
    'goal_and_forecasts',
    'goal_forecasts_and_transactions'
  ) THEN
    RAISE EXCEPTION 'Savings goal deletion mode invalid'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_revision IS NULL
    OR jsonb_typeof(p_revision) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_revision->'templateLines') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_revision->'budgetLines') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_revision->'transactions') IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'Savings goal deletion revision invalid'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('apply_savings_goal_deletion'),
    hashtext(p_goal_id::text)
  );

  PERFORM 1
  FROM public.savings_goal
  WHERE id = p_goal_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  -- Lock children before recomputing the revision. FK checks for new children
  -- and updates to these rows then serialize behind this decision.
  PERFORM 1
  FROM public.template_line tl
  JOIN public.template t ON t.id = tl.template_id
  WHERE tl.savings_goal_id = p_goal_id AND t.user_id = v_uid
  ORDER BY tl.id
  FOR UPDATE OF tl;

  PERFORM 1
  FROM public.budget_line bl
  JOIN public.monthly_budget mb ON mb.id = bl.budget_id
  WHERE bl.savings_goal_id = p_goal_id AND mb.user_id = v_uid
  ORDER BY bl.id
  FOR UPDATE OF bl;

  PERFORM 1
  FROM public.transaction tx
  JOIN public.budget_line bl ON bl.id = tx.budget_line_id
  JOIN public.monthly_budget mb ON mb.id = bl.budget_id
  WHERE bl.savings_goal_id = p_goal_id AND mb.user_id = v_uid
  ORDER BY tx.id
  FOR UPDATE OF tx;

  SELECT jsonb_build_object(
    'templateLines', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', tl.id, 'updatedAt', tl.updated_at)
        ORDER BY tl.id
      )
      FROM public.template_line tl
      JOIN public.template t ON t.id = tl.template_id
      WHERE tl.savings_goal_id = p_goal_id AND t.user_id = v_uid
    ), '[]'::jsonb),
    'budgetLines', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', bl.id, 'updatedAt', bl.updated_at)
        ORDER BY bl.id
      )
      FROM public.budget_line bl
      JOIN public.monthly_budget mb ON mb.id = bl.budget_id
      WHERE bl.savings_goal_id = p_goal_id AND mb.user_id = v_uid
    ), '[]'::jsonb),
    'transactions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', tx.id, 'updatedAt', tx.updated_at)
        ORDER BY tx.id
      )
      FROM public.transaction tx
      JOIN public.budget_line bl ON bl.id = tx.budget_line_id
      JOIN public.monthly_budget mb ON mb.id = bl.budget_id
      WHERE bl.savings_goal_id = p_goal_id AND mb.user_id = v_uid
    ), '[]'::jsonb)
  ) INTO v_current_revision;

  IF NOT (
    (p_revision->'templateLines') @> (v_current_revision->'templateLines')
    AND (v_current_revision->'templateLines') @> (p_revision->'templateLines')
    AND jsonb_array_length(p_revision->'templateLines')
      = jsonb_array_length(v_current_revision->'templateLines')
    AND (p_revision->'budgetLines') @> (v_current_revision->'budgetLines')
    AND (v_current_revision->'budgetLines') @> (p_revision->'budgetLines')
    AND jsonb_array_length(p_revision->'budgetLines')
      = jsonb_array_length(v_current_revision->'budgetLines')
    AND (p_revision->'transactions') @> (v_current_revision->'transactions')
    AND (v_current_revision->'transactions') @> (p_revision->'transactions')
    AND jsonb_array_length(p_revision->'transactions')
      = jsonb_array_length(v_current_revision->'transactions')
  ) THEN
    RAISE EXCEPTION 'Savings goal deletion impact changed'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_mode <> 'goal_only' THEN
    SELECT COALESCE(array_agg(DISTINCT bl.budget_id), '{}'::uuid[])
    INTO v_budget_ids
    FROM public.budget_line bl
    JOIN public.monthly_budget mb ON mb.id = bl.budget_id
    WHERE bl.savings_goal_id = p_goal_id AND mb.user_id = v_uid;
  END IF;

  IF p_mode = 'goal_forecasts_and_transactions' THEN
    DELETE FROM public.transaction tx
    USING public.budget_line bl, public.monthly_budget mb
    WHERE tx.budget_line_id = bl.id
      AND mb.id = bl.budget_id
      AND bl.savings_goal_id = p_goal_id
      AND mb.user_id = v_uid;
  END IF;

  IF p_mode <> 'goal_only' THEN
    DELETE FROM public.budget_line bl
    USING public.monthly_budget mb
    WHERE mb.id = bl.budget_id
      AND bl.savings_goal_id = p_goal_id
      AND mb.user_id = v_uid;

    DELETE FROM public.template_line tl
    USING public.template t
    WHERE t.id = tl.template_id
      AND tl.savings_goal_id = p_goal_id
      AND t.user_id = v_uid;
  END IF;

  DELETE FROM public.savings_goal
  WHERE id = p_goal_id AND user_id = v_uid;

  RETURN QUERY SELECT unnest(v_budget_ids);
END;
$$;

ALTER FUNCTION public.get_savings_goal_deletion_impact(uuid)
  OWNER TO postgres;
ALTER FUNCTION public.apply_savings_goal_deletion(uuid, text, jsonb)
  OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.get_savings_goal_deletion_impact(uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_deletion(uuid, text, jsonb)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_savings_goal_deletion_impact(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_savings_goal_deletion(uuid, text, jsonb)
  TO authenticated, service_role;
