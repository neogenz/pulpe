-- PUL-285 CA5/CA8 — advisory freeze/remove of a goal's future linked lines.
--
-- Mirrors apply_savings_goal_plan (20260713120000): SECURITY DEFINER,
-- per-goal advisory lock (SAME key as plan apply so the two goal-line writers
-- serialize with each other), set-based write with every guard in the WHERE,
-- diagnostic RAISE + full rollback on any shortfall. Eligibility is snapshot
-- and validated BEFORE the write so the diagnostics always read pristine
-- state (a freeze unlinks lines; diagnosing after would mislabel them).
--
-- Guards (CA9): only the caller's own lines, linked to the goal, kind=saving,
-- unchecked, NOT manually adjusted, current-or-future payDay cycle.
--   freeze → keep the prévision, unlink it and set is_manually_adjusted so a
--            later RG-001 propagation cannot re-link or rewrite it;
--   remove → delete the prévision (transactions become free via the existing
--            FK ON DELETE SET NULL).

CREATE OR REPLACE FUNCTION public.apply_savings_goal_generation_stop(
  p_goal_id uuid,
  p_mode text,
  p_budget_line_ids uuid[],
  p_min_period_index int
) RETURNS TABLE (line_id uuid, budget_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_eligible_count integer;
  v_expected_count integer := COALESCE(array_length(p_budget_line_ids, 1), 0);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode NOT IN ('freeze', 'remove') THEN
    RAISE EXCEPTION 'Generation stop mode invalid' USING ERRCODE = 'P0001';
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

  CREATE TEMP TABLE eligible_lines (line_id uuid, budget_id uuid)
    ON COMMIT DROP;

  INSERT INTO eligible_lines (line_id, budget_id)
  SELECT bl.id, bl.budget_id
  FROM public.budget_line bl
  JOIN public.monthly_budget mb ON mb.id = bl.budget_id
  WHERE bl.id = ANY(p_budget_line_ids)
    AND mb.user_id = v_uid
    AND bl.savings_goal_id = p_goal_id
    AND bl.kind = 'saving'::public.transaction_kind
    AND bl.checked_at IS NULL
    AND bl.is_manually_adjusted = false
    AND (mb.year * 12 + mb.month) >= p_min_period_index;

  SELECT COUNT(*) INTO v_eligible_count FROM eligible_lines;

  IF v_eligible_count <> v_expected_count THEN
    IF EXISTS (
      SELECT 1
      FROM unnest(p_budget_line_ids) AS requested(id)
      LEFT JOIN public.budget_line bl
        ON bl.id = requested.id
        AND bl.savings_goal_id = p_goal_id
        AND bl.kind = 'saving'::public.transaction_kind
      LEFT JOIN public.monthly_budget mb
        ON mb.id = bl.budget_id AND mb.user_id = v_uid
      WHERE bl.id IS NULL OR mb.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Generation stop line not linked' USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.budget_line bl
      JOIN public.monthly_budget mb ON mb.id = bl.budget_id AND mb.user_id = v_uid
      WHERE bl.id = ANY(p_budget_line_ids)
        AND bl.savings_goal_id = p_goal_id
        AND bl.checked_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Generation stop line already checked' USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.budget_line bl
      JOIN public.monthly_budget mb ON mb.id = bl.budget_id AND mb.user_id = v_uid
      WHERE bl.id = ANY(p_budget_line_ids)
        AND bl.savings_goal_id = p_goal_id
        AND bl.is_manually_adjusted = true
    ) THEN
      RAISE EXCEPTION 'Generation stop line manually adjusted' USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.budget_line bl
      JOIN public.monthly_budget mb ON mb.id = bl.budget_id AND mb.user_id = v_uid
      WHERE bl.id = ANY(p_budget_line_ids)
        AND bl.savings_goal_id = p_goal_id
        AND (mb.year * 12 + mb.month) < p_min_period_index
    ) THEN
      RAISE EXCEPTION 'Generation stop line in past period' USING ERRCODE = 'P0001';
    END IF;

    RAISE EXCEPTION 'Generation stop line not linked' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode = 'freeze' THEN
    UPDATE public.budget_line bl
    SET savings_goal_id = NULL,
        is_manually_adjusted = true,
        updated_at = NOW()
    FROM eligible_lines t
    WHERE bl.id = t.line_id;
  ELSE
    DELETE FROM public.budget_line bl
    USING eligible_lines t
    WHERE bl.id = t.line_id;
  END IF;

  RETURN QUERY SELECT t.line_id, t.budget_id FROM eligible_lines t;
END;
$$;

ALTER FUNCTION public.apply_savings_goal_generation_stop(uuid, text, uuid[], int)
  OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_generation_stop(uuid, text, uuid[], int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_savings_goal_generation_stop(uuid, text, uuid[], int)
  TO authenticated, service_role;
