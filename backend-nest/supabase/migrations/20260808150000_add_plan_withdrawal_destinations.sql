-- A withdrawal edited from the savings-goal plan has exactly one storage
-- representation per period: either the direct encrypted plan row, or one
-- linked income forecast in an existing budget. The marker distinguishes that
-- plan-owned forecast from incomes users created independently.

ALTER TABLE public.budget_line
  ADD COLUMN IF NOT EXISTS is_savings_goal_plan_adjustment boolean NOT NULL DEFAULT false;

ALTER TABLE public.budget_line
  DROP CONSTRAINT IF EXISTS budget_line_plan_adjustment_shape;
ALTER TABLE public.budget_line
  ADD CONSTRAINT budget_line_plan_adjustment_shape CHECK (
    NOT is_savings_goal_plan_adjustment
    OR (
      source_savings_goal_id IS NOT NULL
      AND kind = 'income'::public.transaction_kind
      AND recurrence = 'one_off'::public.transaction_recurrence
      AND savings_goal_id IS NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS budget_line_unique_savings_goal_plan_adjustment
  ON public.budget_line (source_savings_goal_id, budget_id)
  WHERE is_savings_goal_plan_adjustment;

-- Additive RPC: the legacy apply_savings_goal_plan signature remains callable.
-- Calling the legacy function here keeps every existing line guard in one
-- place; PostgreSQL functions share the surrounding transaction, so a later
-- destination failure rolls those updates back as well.
DROP FUNCTION IF EXISTS public.apply_savings_goal_plan_with_destinations(uuid, int, jsonb, jsonb);
CREATE OR REPLACE FUNCTION public.apply_savings_goal_plan_with_destinations(
  p_goal_id uuid,
  p_min_period_index int,
  p_line_updates jsonb DEFAULT '[]'::jsonb,
  p_plan_withdrawals jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_goal_name text;
  v_updated_lines jsonb := '[]'::jsonb;
  v_upserted_lines jsonb := '[]'::jsonb;
  v_touched_budget_ids uuid[] := '{}'::uuid[];
  v_affected_budget_ids uuid[] := '{}'::uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('apply_savings_goal_plan'),
    hashtext(p_goal_id::text)
  );

  SELECT sg.name INTO v_goal_name
  FROM public.savings_goal sg
  WHERE sg.id = p_goal_id AND sg.user_id = v_uid;

  IF v_goal_name IS NULL THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_plan_withdrawals)
      AS p(month integer, year integer, amount text, destination text)
    WHERE COALESCE(p.destination, 'goal_only') NOT IN ('goal_only', 'linked_income')
  ) THEN
    RAISE EXCEPTION 'Plan withdrawal destination invalid' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_plan_withdrawals)
      AS p(month integer, year integer, amount text, destination text)
    GROUP BY p.month, p.year
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Plan withdrawal period duplicated' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_plan_withdrawals)
      AS p(month integer, year integer, amount text, destination text)
    WHERE p.amount IS NOT NULL
      AND COALESCE(p.destination, 'goal_only') = 'linked_income'
      AND NOT EXISTS (
        SELECT 1 FROM public.monthly_budget mb
        WHERE mb.user_id = v_uid AND mb.month = p.month AND mb.year = p.year
      )
  ) THEN
    RAISE EXCEPTION 'Plan withdrawal budget missing' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.budget_line bl
    JOIN public.monthly_budget mb ON mb.id = bl.budget_id
    JOIN jsonb_to_recordset(p_plan_withdrawals)
      AS p(month integer, year integer, amount text, destination text)
      ON p.month = mb.month AND p.year = mb.year
    WHERE bl.source_savings_goal_id = p_goal_id
      AND bl.is_savings_goal_plan_adjustment
      AND (bl.checked_at IS NOT NULL OR EXISTS (
        SELECT 1 FROM public.transaction tx WHERE tx.budget_line_id = bl.id
      ))
  ) THEN
    RAISE EXCEPTION 'Plan withdrawal already realized' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.budget_line managed
    JOIN public.monthly_budget mb ON mb.id = managed.budget_id
    JOIN jsonb_to_recordset(p_line_updates)
      AS u(budget_line_id uuid, amount text) ON true
    JOIN public.budget_line saving_line
      ON saving_line.id = u.budget_line_id AND saving_line.budget_id = mb.id
    WHERE managed.source_savings_goal_id = p_goal_id
      AND managed.is_savings_goal_plan_adjustment
      AND (managed.checked_at IS NOT NULL OR EXISTS (
        SELECT 1 FROM public.transaction tx WHERE tx.budget_line_id = managed.id
      ))
  ) THEN
    RAISE EXCEPTION 'Plan withdrawal already realized' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(applied)), '[]'::jsonb),
         COALESCE(array_agg(applied.budget_id), '{}'::uuid[])
  INTO v_updated_lines, v_affected_budget_ids
  FROM public.apply_savings_goal_plan(
    p_goal_id, p_min_period_index, p_line_updates, '[]'::jsonb
  ) applied;
  v_touched_budget_ids := v_touched_budget_ids || v_affected_budget_ids;

  -- A positive saving edit replaces only the plan-managed withdrawal for its
  -- period. Independent linked incomes remain untouched and can coexist.
  DELETE FROM public.savings_goal_plan_withdrawal w
  USING public.budget_line saving_line, public.monthly_budget mb,
        jsonb_to_recordset(p_line_updates) AS u(budget_line_id uuid, amount text)
  WHERE saving_line.id = u.budget_line_id
    AND mb.id = saving_line.budget_id
    AND w.savings_goal_id = p_goal_id
    AND w.user_id = v_uid
    AND w.month = mb.month
    AND w.year = mb.year;

  WITH deleted AS (
    DELETE FROM public.budget_line bl
    USING public.monthly_budget mb
    WHERE bl.budget_id = mb.id
      AND bl.source_savings_goal_id = p_goal_id
      AND bl.is_savings_goal_plan_adjustment
      AND mb.user_id = v_uid
      AND EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_line_updates)
          AS u(budget_line_id uuid, amount text)
        JOIN public.budget_line saving_line ON saving_line.id = u.budget_line_id
        WHERE saving_line.budget_id = mb.id
      )
    RETURNING bl.budget_id
  )
  SELECT COALESCE(array_agg(budget_id), '{}'::uuid[])
  INTO v_affected_budget_ids FROM deleted;
  v_touched_budget_ids := v_touched_budget_ids || v_affected_budget_ids;

  -- Every explicit withdrawal edit removes both old representations first.
  -- The chosen one is then inserted below in the same transaction.
  DELETE FROM public.savings_goal_plan_withdrawal w
  USING jsonb_to_recordset(p_plan_withdrawals)
    AS p(month integer, year integer, amount text, destination text)
  WHERE w.savings_goal_id = p_goal_id
    AND w.user_id = v_uid
    AND w.month = p.month
    AND w.year = p.year;

  WITH deleted AS (
    DELETE FROM public.budget_line bl
    USING public.monthly_budget mb,
          jsonb_to_recordset(p_plan_withdrawals)
            AS p(month integer, year integer, amount text, destination text)
    WHERE bl.budget_id = mb.id
      AND mb.user_id = v_uid
      AND bl.source_savings_goal_id = p_goal_id
      AND bl.is_savings_goal_plan_adjustment
      AND mb.month = p.month
      AND mb.year = p.year
    RETURNING bl.budget_id
  )
  SELECT COALESCE(array_agg(budget_id), '{}'::uuid[])
  INTO v_affected_budget_ids FROM deleted;
  v_touched_budget_ids := v_touched_budget_ids || v_affected_budget_ids;

  INSERT INTO public.savings_goal_plan_withdrawal (
    savings_goal_id, user_id, month, year, amount
  )
  SELECT p_goal_id, v_uid, p.month, p.year, p.amount
  FROM jsonb_to_recordset(p_plan_withdrawals)
    AS p(month integer, year integer, amount text, destination text)
  WHERE p.amount IS NOT NULL
    AND COALESCE(p.destination, 'goal_only') = 'goal_only'
  ON CONFLICT (savings_goal_id, year, month)
  DO UPDATE SET amount = EXCLUDED.amount, updated_at = now();

  WITH upserted AS (
    INSERT INTO public.budget_line (
      budget_id, name, amount, kind, recurrence, source_savings_goal_id,
      source_savings_goal_name, is_manually_adjusted,
      is_savings_goal_plan_adjustment
    )
    SELECT mb.id, 'Retrait — ' || v_goal_name, p.amount,
           'income'::public.transaction_kind,
           'one_off'::public.transaction_recurrence,
           p_goal_id, v_goal_name, true, true
    FROM jsonb_to_recordset(p_plan_withdrawals)
      AS p(month integer, year integer, amount text, destination text)
    JOIN public.monthly_budget mb
      ON mb.user_id = v_uid AND mb.month = p.month AND mb.year = p.year
    WHERE p.amount IS NOT NULL
      AND COALESCE(p.destination, 'goal_only') = 'linked_income'
    ON CONFLICT (source_savings_goal_id, budget_id)
      WHERE is_savings_goal_plan_adjustment
    DO UPDATE SET amount = EXCLUDED.amount,
                  name = EXCLUDED.name,
                  updated_at = now()
    RETURNING *
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(upserted)), '[]'::jsonb),
         COALESCE(array_agg(upserted.budget_id), '{}'::uuid[])
  INTO v_upserted_lines, v_affected_budget_ids
  FROM upserted;
  v_updated_lines := v_updated_lines || v_upserted_lines;
  v_touched_budget_ids := v_touched_budget_ids || v_affected_budget_ids;

  RETURN jsonb_build_object(
    'updated_lines', v_updated_lines,
    'touched_budget_ids', to_jsonb(ARRAY(
      SELECT DISTINCT budget_id
      FROM unnest(v_touched_budget_ids) AS budget_id
    ))
  );
END;
$$;

ALTER FUNCTION public.apply_savings_goal_plan_with_destinations(uuid, int, jsonb, jsonb)
  OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_plan_with_destinations(uuid, int, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_savings_goal_plan_with_destinations(uuid, int, jsonb, jsonb)
  TO authenticated, service_role;
