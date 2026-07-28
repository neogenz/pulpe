-- PUL-313 — atomically advance a savings-goal deadline and reconcile every
-- eligible linked forecast that now falls strictly after the new horizon.
--
-- The confirmed IDs must equal the candidate set rebuilt under the same
-- per-goal advisory lock used by plan/generation-stop writers. Any drift,
-- ownership failure or invalid patch raises and rolls back both goal and lines.

DROP FUNCTION IF EXISTS public.reconcile_savings_goal_target_date(
  uuid, text, uuid[], int, int, jsonb
);

CREATE OR REPLACE FUNCTION public.reconcile_savings_goal_target_date(
  p_goal_id uuid,
  p_mode text,
  p_budget_line_ids uuid[],
  p_expected_target_date date,
  p_patch jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_goal public.savings_goal%ROWTYPE;
  v_candidate record;
  v_candidate_ids uuid[];
  v_confirmed_ids uuid[];
  v_affected_line_ids uuid[];
  v_touched_budget_ids uuid[];
  v_pay_day int;
  v_new_start_date date;
  v_new_target_date date;
  v_current_period_start date;
  v_previous_target_period_start date;
  v_new_target_period_start date;
  v_current_period_index int;
  v_previous_target_period_index int;
  v_new_target_period_index int;
  v_goal_json jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode NOT IN ('freeze', 'remove') THEN
    RAISE EXCEPTION 'Savings goal reconciliation mode invalid'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_patch) <> 'object'
    OR NOT (p_patch ? 'target_date')
    OR p_patch->'target_date' = 'null'::jsonb
  THEN
    RAISE EXCEPTION 'Savings goal reconciliation patch invalid'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_patch) AS patch_key
    WHERE patch_key NOT IN (
      'name',
      'start_date',
      'target_amount',
      'target_date',
      'status',
      'original_target_amount',
      'original_currency',
      'target_currency',
      'exchange_rate',
      'initial_amount'
    )
  ) THEN
    RAISE EXCEPTION 'Savings goal reconciliation patch invalid'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('apply_savings_goal_plan'),
    hashtext(p_goal_id::text)
  );

  SELECT *
  INTO v_goal
  FROM public.savings_goal
  WHERE id = p_goal_id
    AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  IF v_goal.target_date IS NULL
    OR v_goal.target_date IS DISTINCT FROM p_expected_target_date
  THEN
    RAISE EXCEPTION 'Savings goal reconciliation conflict'
      USING ERRCODE = 'P0001';
  END IF;

  v_new_target_date := (p_patch->>'target_date')::date;
  v_new_start_date := CASE
    WHEN p_patch ? 'start_date' THEN (p_patch->>'start_date')::date
    ELSE v_goal.start_date
  END;
  IF v_new_start_date IS NOT NULL
    AND v_new_start_date > v_new_target_date
  THEN
    RAISE EXCEPTION 'Savings goal reconciliation patch invalid'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT CASE
    WHEN raw_user_meta_data->>'payDayOfMonth' ~ '^[0-9]+$'
    THEN GREATEST(
      1,
      LEAST(31, (raw_user_meta_data->>'payDayOfMonth')::int)
    )
    ELSE NULL
  END
  INTO v_pay_day
  FROM auth.users
  WHERE id = v_uid;

  v_current_period_start := date_trunc('month', CURRENT_DATE)::date;
  v_previous_target_period_start :=
    date_trunc('month', v_goal.target_date)::date;
  v_new_target_period_start := date_trunc('month', v_new_target_date)::date;

  IF v_pay_day IS NOT NULL AND v_pay_day <> 1 THEN
    IF EXTRACT(DAY FROM CURRENT_DATE) < v_pay_day THEN
      v_current_period_start :=
        (v_current_period_start - INTERVAL '1 month')::date;
    END IF;
    IF EXTRACT(DAY FROM v_goal.target_date) < v_pay_day THEN
      v_previous_target_period_start :=
        (v_previous_target_period_start - INTERVAL '1 month')::date;
    END IF;
    IF EXTRACT(DAY FROM v_new_target_date) < v_pay_day THEN
      v_new_target_period_start :=
        (v_new_target_period_start - INTERVAL '1 month')::date;
    END IF;
    IF v_pay_day > 15 THEN
      v_current_period_start :=
        (v_current_period_start + INTERVAL '1 month')::date;
      v_previous_target_period_start :=
        (v_previous_target_period_start + INTERVAL '1 month')::date;
      v_new_target_period_start :=
        (v_new_target_period_start + INTERVAL '1 month')::date;
    END IF;
  END IF;

  v_current_period_index :=
    EXTRACT(YEAR FROM v_current_period_start)::int * 12
    + EXTRACT(MONTH FROM v_current_period_start)::int;
  v_previous_target_period_index :=
    EXTRACT(YEAR FROM v_previous_target_period_start)::int * 12
    + EXTRACT(MONTH FROM v_previous_target_period_start)::int;
  v_new_target_period_index :=
    EXTRACT(YEAR FROM v_new_target_period_start)::int * 12
    + EXTRACT(MONTH FROM v_new_target_period_start)::int;

  IF v_new_target_period_index >= v_previous_target_period_index THEN
    RAISE EXCEPTION 'Savings goal reconciliation conflict'
      USING ERRCODE = 'P0001';
  END IF;

  CREATE TEMP TABLE reconciliation_candidates (
    line_id uuid PRIMARY KEY,
    budget_id uuid NOT NULL
  ) ON COMMIT DROP;

  -- Lock the exact candidate rows while taking the authoritative snapshot.
  FOR v_candidate IN
    SELECT bl.id AS line_id, bl.budget_id
    FROM public.budget_line bl
    JOIN public.monthly_budget mb ON mb.id = bl.budget_id
    WHERE mb.user_id = v_uid
      AND bl.savings_goal_id = p_goal_id
      AND bl.kind = 'saving'::public.transaction_kind
      AND bl.checked_at IS NULL
      AND bl.is_manually_adjusted = false
      AND (mb.year * 12 + mb.month) >= v_current_period_index
      AND (mb.year * 12 + mb.month) > v_new_target_period_index
    FOR UPDATE OF bl
  LOOP
    INSERT INTO reconciliation_candidates (line_id, budget_id)
    VALUES (v_candidate.line_id, v_candidate.budget_id);
  END LOOP;

  SELECT COALESCE(array_agg(line_id ORDER BY line_id), ARRAY[]::uuid[])
  INTO v_candidate_ids
  FROM reconciliation_candidates;

  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_confirmed_ids
  FROM (
    SELECT DISTINCT requested.id
    FROM unnest(COALESCE(p_budget_line_ids, ARRAY[]::uuid[])) AS requested(id)
  ) confirmed;

  IF COALESCE(array_length(p_budget_line_ids, 1), 0)
      <> COALESCE(array_length(v_confirmed_ids, 1), 0)
    OR v_candidate_ids <> v_confirmed_ids
  THEN
    RAISE EXCEPTION 'Savings goal reconciliation conflict'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_mode = 'freeze' THEN
    UPDATE public.budget_line bl
    SET savings_goal_id = NULL,
        is_manually_adjusted = true,
        updated_at = NOW()
    FROM reconciliation_candidates candidate
    WHERE bl.id = candidate.line_id;
  ELSE
    DELETE FROM public.budget_line bl
    USING reconciliation_candidates candidate
    WHERE bl.id = candidate.line_id;
  END IF;

  UPDATE public.savings_goal sg
  SET
    name = CASE
      WHEN p_patch ? 'name' THEN p_patch->>'name'
      ELSE sg.name
    END,
    start_date = CASE
      WHEN p_patch ? 'start_date' THEN (p_patch->>'start_date')::date
      ELSE sg.start_date
    END,
    target_amount = CASE
      WHEN p_patch ? 'target_amount' THEN p_patch->>'target_amount'
      ELSE sg.target_amount
    END,
    target_date = v_new_target_date,
    status = CASE
      WHEN p_patch ? 'status'
      THEN (p_patch->>'status')::public.savings_goal_status
      ELSE sg.status
    END,
    original_target_amount = CASE
      WHEN p_patch ? 'original_target_amount'
      THEN p_patch->>'original_target_amount'
      ELSE sg.original_target_amount
    END,
    original_currency = CASE
      WHEN p_patch ? 'original_currency' THEN p_patch->>'original_currency'
      ELSE sg.original_currency
    END,
    target_currency = CASE
      WHEN p_patch ? 'target_currency' THEN p_patch->>'target_currency'
      ELSE sg.target_currency
    END,
    exchange_rate = CASE
      WHEN p_patch ? 'exchange_rate'
      THEN (p_patch->>'exchange_rate')::numeric
      ELSE sg.exchange_rate
    END,
    initial_amount = CASE
      WHEN p_patch ? 'initial_amount' THEN p_patch->>'initial_amount'
      ELSE sg.initial_amount
    END,
    updated_at = NOW()
  WHERE sg.id = p_goal_id
    AND sg.user_id = v_uid
  RETURNING to_jsonb(sg) INTO v_goal_json;

  SELECT
    COALESCE(
      array_agg(line_id ORDER BY line_id),
      ARRAY[]::uuid[]
    ),
    COALESCE(
      array_agg(DISTINCT budget_id ORDER BY budget_id),
      ARRAY[]::uuid[]
    )
  INTO v_affected_line_ids, v_touched_budget_ids
  FROM reconciliation_candidates;

  RETURN jsonb_build_object(
    'goal', v_goal_json,
    'affected_line_ids', v_affected_line_ids,
    'touched_budget_ids', v_touched_budget_ids
  );
END;
$$;

ALTER FUNCTION public.reconcile_savings_goal_target_date(
  uuid, text, uuid[], date, jsonb
) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.reconcile_savings_goal_target_date(
  uuid, text, uuid[], date, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_savings_goal_target_date(
  uuid, text, uuid[], date, jsonb
) TO authenticated, service_role;
