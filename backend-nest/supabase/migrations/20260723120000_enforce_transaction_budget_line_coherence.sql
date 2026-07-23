-- Security audit 2026-07-23 — enforce transaction.budget_line_id coherence at
-- the DB boundary.
--
-- RLS proves the transaction belongs to the caller and the FK proves
-- budget_line_id exists, but nothing proved the referenced budget_line belongs
-- to the SAME budget as the transaction (20251223121017 delegated that check
-- to the app layer). An incoherent link corrupts envelope consumption math and
-- lets check_unchecked_transactions mutate lines outside the transaction's
-- budget. Mirror of enforce_savings_goal_line_link (20260701083300), which
-- closed the identical gap for savings_goal_id. Requiring the same budget_id
-- also guarantees the same tenant: both rows hang off the same monthly_budget.

CREATE OR REPLACE FUNCTION public.enforce_transaction_budget_line_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_line_budget_id uuid;
BEGIN
  IF NEW.budget_line_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT bl.budget_id
  INTO v_line_budget_id
  FROM public.budget_line bl
  WHERE bl.id = NEW.budget_line_id;

  IF v_line_budget_id IS NULL OR v_line_budget_id <> NEW.budget_id THEN
    RAISE EXCEPTION 'Budget line access denied'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_transaction_budget_line_link() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_transaction_budget_line_link()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_transaction_budget_line_link
  ON public.transaction;
CREATE TRIGGER enforce_transaction_budget_line_link
  BEFORE INSERT OR UPDATE OF budget_line_id, budget_id
  ON public.transaction
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_transaction_budget_line_link();
