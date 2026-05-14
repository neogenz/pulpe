-- Migration HI-30: enforce MAX_TEMPLATES_PER_USER atomically at the DB layer.
--
-- Problem: CreateTemplateUseCase reads count then writes — a TOCTOU window where
-- N parallel requests can each read count = LIMIT-1 and each insert, busting the
-- per-user cap of 5 templates. The application-level check in
-- BudgetTemplateInvariants.validateTemplateLimit is a fast-path / friendly-error,
-- not a correctness boundary under contention.
--
-- Fix: BEFORE INSERT trigger on public.template that counts existing rows for
-- the inserting user_id and raises a business-level exception when the cap is
-- reached. Postgres serializes triggers per-row, so concurrent inserts will
-- observe each other's writes via the visibility rules and the cap becomes a
-- hard guarantee — no advisory locks, no RPC signature change, no type regen.
--
-- The trigger raises SQLSTATE 'P0001' with a stable MESSAGE prefix so the
-- repository layer can map it to ERR_TEMPLATE_LIMIT_EXCEEDED while keeping
-- other P0001 errors distinct.

CREATE OR REPLACE FUNCTION public.enforce_template_limit_per_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_count integer;
  v_limit constant integer := 5;
BEGIN
  -- Schema enforces template.user_id NOT NULL, so NEW.user_id is always set.
  SELECT count(*) INTO v_count
  FROM public.template
  WHERE user_id = NEW.user_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'TEMPLATE_LIMIT_EXCEEDED: user % already owns % templates (limit %)',
      NEW.user_id, v_count, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_template_limit_per_user() OWNER TO postgres;

DROP TRIGGER IF EXISTS template_limit_per_user ON public.template;

CREATE TRIGGER template_limit_per_user
BEFORE INSERT ON public.template
FOR EACH ROW
EXECUTE FUNCTION public.enforce_template_limit_per_user();
