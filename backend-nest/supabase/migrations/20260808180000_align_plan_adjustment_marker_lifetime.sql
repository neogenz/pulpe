-- Two holes left by 20260808150000.
--
-- 1. budget_line_plan_adjustment_shape promises "marker set => this row is the
--    plan's linked-income representation". Nothing kept that promise true when
--    the row stopped being one. Deleting the goal fires ON DELETE SET NULL on
--    source_savings_goal_id, and the budget edit dialog lets the user change
--    kind or recurrence: all three left the marker set and hit 23514, which no
--    error mapping turns into anything a user can act on. Deleting a goal that
--    carried a linked_income plan withdrawal was simply impossible.
--    The marker now expires with the shape it asserts, in one place every
--    writer already goes through.
-- 2. The destination RPC validated destination, duplicate period, budget
--    existence and realization, but handed '[]' to the function holding the
--    period guard, so it never ran on the path the backend actually calls.

-- ---------------------------------------------------------------------------
-- 1. The marker expires with the shape
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clear_budget_line_plan_adjustment_marker()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  -- budget_line_plan_adjustment_shape states the invariant; this keeps it
  -- satisfiable. A row that leaves the shape is no longer the plan's
  -- representation of anything -- the goal is gone, or the user turned the line
  -- into their own -- so the plan stops claiming it instead of the write
  -- failing.
  --
  -- The CHECK also demands savings_goal_id IS NULL, and this deliberately does
  -- not test it. A BEFORE trigger sees an intermediate NEW, the CHECK sees the
  -- final row, and enforce_savings_goal_line_link -- which runs after this one
  -- by name order -- nulls savings_goal_id for anything that is not a saving.
  -- Reading it here would destroy the marker over a value the row never keeps:
  -- a PATCH carrying only savingsGoalId stores a byte-identical row, and the
  -- plan would stop recognising its own representation and write a second one.
  -- Nothing is lost by omitting it, because a marked row is an income, so that
  -- same sibling guarantees its savings_goal_id ends up null. Of every BEFORE
  -- trigger on this table, that sibling is the only one that assigns to a
  -- column read below.
  IF NEW.is_savings_goal_plan_adjustment AND (
    NEW.source_savings_goal_id IS NULL
    OR NEW.kind <> 'income'::public.transaction_kind
    OR NEW.recurrence <> 'one_off'::public.transaction_recurrence
  ) THEN
    NEW.is_savings_goal_plan_adjustment := false;
  END IF;
  RETURN NEW;
END;
$$;

-- Left SECURITY INVOKER, unlike the enforce_* siblings: it reads nothing and
-- only rewrites NEW, so it needs no rights of its own. The REVOKE matches the
-- series hygiene; a RETURNS trigger function cannot be called directly anyway.
REVOKE ALL ON FUNCTION public.clear_budget_line_plan_adjustment_marker()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS clear_budget_line_plan_adjustment_marker
  ON public.budget_line;
-- Fires before enforce_budget_line_savings_goal_* by name order, and covers the
-- referential SET NULL, which performs an ordinary UPDATE of that column.
CREATE TRIGGER clear_budget_line_plan_adjustment_marker
  BEFORE UPDATE OF
    source_savings_goal_id, kind, recurrence, savings_goal_id
  ON public.budget_line
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_budget_line_plan_adjustment_marker();

-- ---------------------------------------------------------------------------
-- 2. The period guard runs on the path the backend calls
-- ---------------------------------------------------------------------------

-- Unchanged from 20260808170000 apart from the guard below. The core is
-- revoked from every role, so this wrapper is the whole reachable surface and
-- validating the caller's own payload here costs no lock.
CREATE OR REPLACE FUNCTION public.apply_savings_goal_plan_with_destinations(
  p_goal_id uuid,
  p_min_period_index int,
  p_line_updates jsonb,
  p_plan_withdrawals jsonb,
  p_expected_revision bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- apply_savings_goal_plan holds this guard, but the destination core hands it
  -- '[]' and writes the withdrawals itself, so nothing below the use case
  -- checked the period. Same message as the legacy path: the backend maps it by
  -- exact string.
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_plan_withdrawals)
      AS p(month integer, year integer, amount text, destination text)
    WHERE p.month IS NULL
      OR p.year IS NULL
      OR p.month NOT BETWEEN 1 AND 12
      OR p.year NOT BETWEEN 1 AND 9999
      OR (p.year * 12 + p.month) < p_min_period_index
      OR (p.amount IS NOT NULL AND btrim(p.amount) = '')
  ) THEN
    RAISE EXCEPTION 'Plan line in past period' USING ERRCODE = 'P0001';
  END IF;

  -- Same order as apply_savings_goal_plan: the plan lock first, then the
  -- withdrawal lock and the goal row that lock_savings_goal_for_withdrawal
  -- takes.
  PERFORM pg_advisory_xact_lock(
    hashtext('apply_savings_goal_plan'),
    hashtext(p_goal_id::text)
  );
  PERFORM public.lock_savings_goal_for_withdrawal(
    p_goal_id, p_expected_revision
  );
  RETURN public.apply_savings_goal_plan_with_destinations_core(
    p_goal_id, p_min_period_index, p_line_updates, p_plan_withdrawals
  );
END;
$$;

ALTER FUNCTION public.apply_savings_goal_plan_with_destinations(
  uuid, int, jsonb, jsonb, bigint
) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_plan_with_destinations(
  uuid, int, jsonb, jsonb, bigint
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_savings_goal_plan_with_destinations(
  uuid, int, jsonb, jsonb, bigint
) TO authenticated, service_role;
