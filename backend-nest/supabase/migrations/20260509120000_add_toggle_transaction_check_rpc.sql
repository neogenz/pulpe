-- HI-14: atomic toggle for transaction.checked_at to fix lost-update race.
--
-- Background: prior implementation read transaction.checked_at then computed
-- the new value in NestJS and issued a separate UPDATE. Two concurrent toggles
-- could read the same value, write the same new value, and effectively no-op
-- one of the user actions.
--
-- This RPC uses FOR UPDATE row lock + single statement decision so two
-- concurrent calls serialize through Postgres locking and produce the
-- expected "toggle twice = back to original" semantics.
--
-- Per Option A product decision (HI-15): toggle is a pure UI / reconciliation
-- signal. checked_at does NOT participate in ending_balance recalculation.
-- This RPC therefore does NOT touch monthly_budget.ending_balance.
--
-- Mirrors `toggle_budget_line_check` (no cascade — transaction toggle is
-- per-row, the budget-line toggle does not cascade since 2026-02-09).
CREATE OR REPLACE FUNCTION public.toggle_transaction_check(
  p_transaction_id uuid
) RETURNS public.transaction
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_current_checked_at timestamptz;
  v_new_checked_at timestamptz;
  v_result public.transaction;
BEGIN
  -- Get current checked_at to determine toggle direction.
  -- Ownership verified via monthly_budget.user_id (same as RLS policy).
  -- FOR UPDATE locks the row to prevent concurrent toggle races.
  SELECT t.checked_at INTO v_current_checked_at
  FROM public.transaction t
  JOIN public.monthly_budget mb ON mb.id = t.budget_id
  WHERE t.id = p_transaction_id
    AND mb.user_id = auth.uid()
  FOR UPDATE OF t;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or access denied';
  END IF;

  -- Toggle: if checked → uncheck (NULL), if unchecked → check (now)
  IF v_current_checked_at IS NOT NULL THEN
    v_new_checked_at := NULL;
  ELSE
    v_new_checked_at := v_now;
  END IF;

  UPDATE public.transaction
  SET checked_at = v_new_checked_at,
      updated_at = v_now
  WHERE id = p_transaction_id;

  SELECT * INTO v_result
  FROM public.transaction
  WHERE id = p_transaction_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_transaction_check(uuid) TO authenticated;
