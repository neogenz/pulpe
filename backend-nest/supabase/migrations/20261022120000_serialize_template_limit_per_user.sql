-- pulpe:migration-phase expand
-- The per-user template cap counted rows without a lock. Under READ COMMITTED a
-- concurrent insert does not see another one's uncommitted row, so two callers
-- at 4 templates both counted 4 and the user ended with 6 (an agent issuing
-- parallel duplicate_template calls reaches this as easily as a double click).
--
-- A transaction-scoped advisory lock keyed on the user queues the inserts: the
-- second one waits until the first commits, and its count, a fresh statement
-- snapshot, then includes that row. Other users never share the key.

CREATE OR REPLACE FUNCTION public.enforce_template_limit_per_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_count integer;
  v_limit constant integer := 5;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('template_limit'),
    hashtext(NEW.user_id::text)
  );

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
