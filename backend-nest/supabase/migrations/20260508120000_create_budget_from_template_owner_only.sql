-- Migration: restrict create_budget_from_template to template owner only.
--
-- Background: prior versions of this RPC accepted templates where
-- `user_id IS NULL` (intended as "public templates"). The function copies
-- `template_line.amount` ciphertext verbatim into `budget_line.amount`.
--
-- After encryption was introduced (column is `text` storing AES-256-GCM
-- ciphertext encoded base64, derived from a per-user DEK), copying ciphertext
-- across users is broken: the budget owner's DEK cannot decrypt a ciphertext
-- encrypted under a different DEK. The application's `tryDecryptAmount`
-- fallback silently returns 0 — corrupting budget amounts without any error.
--
-- No production code path currently creates `user_id IS NULL` templates, so
-- this branch is latent. We close the door at the boundary: the RPC accepts
-- only templates owned by the requesting user. Public templates as a feature
-- require a dedicated server-side re-encryption design (deferred — see
-- ADR-0010).
--
-- Behavioral diff vs prior version (20260417120000):
--   - WHERE clause: `(user_id = p_user_id OR user_id IS NULL)` → `user_id = p_user_id`
-- Everything else (FX column copy, period uniqueness check, return shape) is
-- preserved verbatim.

CREATE OR REPLACE FUNCTION public.create_budget_from_template(
  p_user_id uuid,
  p_template_id uuid,
  p_month integer,
  p_year integer,
  p_description text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  new_budget_id uuid;
  template_record record;
  template_line_record record;
  budget_line_count integer := 0;
BEGIN
  SELECT id, user_id, name INTO template_record
  FROM public.template
  WHERE id = p_template_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.monthly_budget
    WHERE user_id = p_user_id
      AND month = p_month
      AND year = p_year
  ) THEN
    RAISE EXCEPTION 'Budget already exists for this period';
  END IF;

  INSERT INTO public.monthly_budget (user_id, template_id, month, year, description)
  VALUES (p_user_id, p_template_id, p_month, p_year, p_description)
  RETURNING id INTO new_budget_id;

  FOR template_line_record IN
    SELECT tl.id, tl.amount, tl.kind, tl.recurrence, tl.name, tl.description,
           tl.original_amount, tl.original_currency, tl.target_currency, tl.exchange_rate
    FROM public.template_line tl
    WHERE tl.template_id = p_template_id
    ORDER BY tl.created_at
  LOOP
    INSERT INTO public.budget_line (
      budget_id, template_line_id, amount, kind, recurrence, name,
      original_amount, original_currency, target_currency, exchange_rate
    ) VALUES (
      new_budget_id,
      template_line_record.id,
      template_line_record.amount,
      template_line_record.kind,
      template_line_record.recurrence,
      template_line_record.name,
      template_line_record.original_amount,
      template_line_record.original_currency,
      template_line_record.target_currency,
      template_line_record.exchange_rate
    );

    budget_line_count := budget_line_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'budget', (
      SELECT to_jsonb(b.*)
      FROM public.monthly_budget b
      WHERE b.id = new_budget_id
    ),
    'budget_lines_created', budget_line_count,
    'template_name', template_record.name
  );
END;
$$;

ALTER FUNCTION public.create_budget_from_template(uuid, uuid, integer, integer, text) OWNER TO postgres;
