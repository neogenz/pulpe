-- pulpe:migration-phase contract
-- pulpe:safe-after v0.54.1
--
-- An allocated transaction carries the kind of its budget_line: creation and
-- PATCH /transactions/:id already refuse anything else. Nothing held the rule
-- from the other side, so a budget_line changing kind left its transactions
-- on the old one, where the envelope formulas filter them out of every total.
--
-- A budget_line changes kind through four paths: update_budget_line_with_tags
-- (web, iOS, Android, the MCP update_forecast tool), reset from the template,
-- and Mois Type propagation inside apply_template_line_operations. One trigger
-- covers them all and moves the transactions in the same statement.
--
-- A planned-withdrawal line is pinned to 'income' by
-- budget_line_source_savings_goal_one_off_income, so a withdrawal transaction
-- (which may only be allocated to such a line) is never re-kinded here.
--
-- SECURITY INVOKER: an allocated transaction shares its line's budget
-- (enforce_transaction_budget_line_link), so the owner who may update the line
-- may update its transactions under RLS.

CREATE OR REPLACE FUNCTION public.align_allocated_transaction_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.transaction t
  SET kind = NEW.kind
  WHERE t.budget_line_id = NEW.id
    AND t.kind IS DISTINCT FROM NEW.kind;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.align_allocated_transaction_kind()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER align_allocated_transaction_kind
  AFTER UPDATE OF kind ON public.budget_line
  FOR EACH ROW
  WHEN (NEW.kind IS DISTINCT FROM OLD.kind)
  EXECUTE FUNCTION public.align_allocated_transaction_kind();
