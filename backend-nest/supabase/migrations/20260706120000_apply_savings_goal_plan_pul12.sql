-- PUL-12 — apply a simulated savings-goal plan atomically (POST /savings-goals/:id/plan).
--
-- The simulator lets the user redistribute their remaining effort across the open
-- months of a goal, then applies the result in ONE round-trip. This RPC writes the
-- new per-month amounts (already AES-256-GCM encrypted by the repository) onto the
-- linked, non-checked, current-or-future saving lines, and optionally onto the
-- goal's template lines (the "Mois Type" horizon beyond the last generated budget).
--
-- Design mirrors the spread stack (20260626120000_spread_group_idempotency_guard):
--   1. pg_advisory_xact_lock keyed on the goal id serializes concurrent applies of
--      the SAME goal (double-tap), while different goals never contend.
--   2. A SINGLE set-based UPDATE carries every guard in its WHERE — tenant, link,
--      kind, not-checked, not-in-a-past-cycle — so there is no check-then-act
--      window under READ COMMITTED. A line that fails ANY guard is simply not
--      updated; the count then differs from the request and the whole transaction
--      RAISEs (all-or-nothing, nothing partial).
--   3. On a count mismatch a diagnostic SELECT picks the exact reason so the
--      repository can map it to the right HTTP status (422 vs 409).
--
-- NO idempotency key (unlike the spread INSERT): this is an UPDATE-by-value, so a
-- retry re-writes the same amounts (fresh ciphertexts decrypting to the same
-- numbers) and re-sets the same flags → identical final state, idempotent recalc.
-- The advisory lock closes the double-tap race.
--
-- The amount-only UPDATE does NOT list savings_goal_id / kind / budget_id, so the
-- enforce_savings_goal_line_link trigger (BEFORE UPDATE OF those columns) never
-- fires → zero per-row trigger overhead.

CREATE OR REPLACE FUNCTION public.apply_savings_goal_plan(
  p_goal_id uuid,
  p_min_period_index int,              -- year*12+month of the payDay-aware current cycle (computed server-side)
  p_line_updates jsonb DEFAULT '[]'::jsonb,      -- [{budget_line_id uuid, amount text}] amount = ciphertext, stored as-is
  p_template_updates jsonb DEFAULT '[]'::jsonb   -- [{template_line_id uuid, amount text}]
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
  v_template_count integer;
  v_expected_template_count integer := jsonb_array_length(p_template_updates);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Serialize concurrent applies of the same goal (double-tap); other goals free.
  PERFORM pg_advisory_xact_lock(
    hashtext('apply_savings_goal_plan'),
    hashtext(p_goal_id::text)
  );

  -- Ownership. Message reused by the enforce trigger → the repo maps it to 404.
  IF NOT EXISTS (
    SELECT 1 FROM public.savings_goal
    WHERE id = p_goal_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  -- Budget line leg: one set-based UPDATE, all guards in the WHERE (no window).
  -- monthly_budget joins via the FROM comma-list (an UPDATE target cannot be
  -- referenced from a JOIN's ON clause), correlated to bl in the WHERE.
  WITH updated AS (
    UPDATE public.budget_line bl
    SET amount = u.amount,
        is_manually_adjusted = true,
        updated_at = NOW()
    FROM jsonb_to_recordset(p_line_updates)
      AS u(budget_line_id uuid, amount text),
      public.monthly_budget mb
    WHERE bl.id = u.budget_line_id
      AND mb.id = bl.budget_id                                -- correlate parent budget
      AND mb.user_id = v_uid                                  -- tenant (SECURITY DEFINER bypasses RLS)
      AND bl.savings_goal_id = p_goal_id                      -- linked to this goal
      AND bl.kind = 'saving'::public.transaction_kind         -- double kind guard
      AND bl.checked_at IS NULL                               -- checked = locked
      AND (mb.year * 12 + mb.month) >= p_min_period_index     -- past cycles locked
    RETURNING bl.id
  )
  SELECT array_agg(id) INTO v_updated_ids FROM updated;

  v_line_count := COALESCE(array_length(v_updated_ids, 1), 0);

  -- Any shortfall means at least one requested line failed a guard. Diagnose the
  -- reason (in priority order) and RAISE — the whole transaction rolls back.
  IF v_line_count <> v_expected_line_count THEN
    -- Missing / foreign / unlinked / non-saving line.
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

    -- Linked but already checked (pointé).
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

    -- Linked, unchecked, but the cycle rolled into the past during the simulation.
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

    -- Fallback: the shortfall has no attributable reason (should not happen).
    RAISE EXCEPTION 'Plan line not linked' USING ERRCODE = 'P0001';
  END IF;

  -- Template leg: same shape. Amount changes do NOT propagate to already-generated
  -- budgets — that stays an explicit, separate flow. No is_manually_adjusted here
  -- (that flag is a budget_line concept).
  WITH updated_tpl AS (
    UPDATE public.template_line tl
    SET amount = u.amount,
        updated_at = NOW()
    FROM jsonb_to_recordset(p_template_updates)
      AS u(template_line_id uuid, amount text)
    WHERE tl.id = u.template_line_id
      AND tl.savings_goal_id = p_goal_id
      AND tl.kind = 'saving'::public.transaction_kind
      AND EXISTS (
        SELECT 1 FROM public.template t
        WHERE t.id = tl.template_id AND t.user_id = v_uid
      )
    RETURNING tl.id
  )
  SELECT count(*) INTO v_template_count FROM updated_tpl;

  IF v_template_count <> v_expected_template_count THEN
    RAISE EXCEPTION 'Plan template line not linked' USING ERRCODE = 'P0001';
  END IF;

  -- Return the updated budget lines (committed within this transaction).
  RETURN QUERY
  SELECT bl.* FROM public.budget_line bl
  WHERE bl.id = ANY(v_updated_ids);
END;
$$;

ALTER FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  TO authenticated, service_role;
