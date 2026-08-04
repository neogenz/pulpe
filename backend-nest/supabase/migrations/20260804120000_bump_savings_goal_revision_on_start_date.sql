-- PUL-329 follow-up — the start date belongs to the balance it decides.
--
-- `balance_revision` guards a balance the backend decrypted and checked: any
-- change that moves that balance must invalidate a read taken before it.
-- Moving the start date does exactly that. It anchors the contribution window
-- (`historicalAnchorIndex` in savings-goal-progress.ts), so a date pushed
-- forward drops every earlier linked forecast out of the confirmed stock —
-- without touching a single amount. The revision stayed put, and a withdrawal
-- computed against the wider window was still accepted afterwards.
--
-- The column list on the trigger is the load-bearing half: `UPDATE OF` fires
-- on the columns the statement mentions, so extending the function body alone
-- would leave a start-date-only edit silently untriggered.

CREATE OR REPLACE FUNCTION public.bump_own_savings_goal_balance_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.initial_amount IS DISTINCT FROM OLD.initial_amount
    OR NEW.start_date IS DISTINCT FROM OLD.start_date
  THEN
    NEW.balance_revision := OLD.balance_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bump_own_savings_goal_balance_revision
  ON public.savings_goal;
CREATE TRIGGER bump_own_savings_goal_balance_revision
  BEFORE UPDATE OF initial_amount, start_date ON public.savings_goal
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_own_savings_goal_balance_revision();
