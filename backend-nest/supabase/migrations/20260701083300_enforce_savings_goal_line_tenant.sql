-- PUL-12 — enforce savings_goal_id tenant coherence at the DB boundary.
--
-- RLS on budget_line/template_line proves the line belongs to the caller, but a
-- plain FK only proves savings_goal_id exists. This trigger closes the gap for
-- all write paths, including SECURITY DEFINER RPCs: a tagged line must be a
-- saving line and the referenced goal must belong to the same owner as the
-- budget/template that owns the line.

CREATE OR REPLACE FUNCTION public.enforce_savings_goal_line_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF NEW.kind <> 'saving'::public.transaction_kind THEN
    NEW.savings_goal_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.savings_goal_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'budget_line' THEN
    SELECT mb.user_id
    INTO v_owner_id
    FROM public.monthly_budget mb
    WHERE mb.id = NEW.budget_id;
  ELSIF TG_TABLE_NAME = 'template_line' THEN
    SELECT t.user_id
    INTO v_owner_id
    FROM public.template t
    WHERE t.id = NEW.template_id;
  ELSE
    RAISE EXCEPTION 'Unsupported savings goal link table: %', TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;

  IF v_owner_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.savings_goal sg
    WHERE sg.id = NEW.savings_goal_id
      AND sg.user_id = v_owner_id
  ) THEN
    RAISE EXCEPTION 'Savings goal access denied'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_savings_goal_line_link() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_savings_goal_line_link()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_budget_line_savings_goal_link
  ON public.budget_line;
CREATE TRIGGER enforce_budget_line_savings_goal_link
  BEFORE INSERT OR UPDATE OF savings_goal_id, kind, budget_id
  ON public.budget_line
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_savings_goal_line_link();

DROP TRIGGER IF EXISTS enforce_template_line_savings_goal_link
  ON public.template_line;
CREATE TRIGGER enforce_template_line_savings_goal_link
  BEFORE INSERT OR UPDATE OF savings_goal_id, kind, template_id
  ON public.template_line
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_savings_goal_line_link();
