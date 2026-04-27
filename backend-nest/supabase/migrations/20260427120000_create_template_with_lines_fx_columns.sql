-- Migration: PUL-133 - Add FX columns to create_template_with_lines RPC
-- Bug: bulk template creation silently dropped original_amount, original_currency,
-- target_currency, exchange_rate. Brings parity with single-line createTemplateLine
-- and apply_template_line_operations (migration 20260417120000).
--
-- Pattern mirrors apply_template_line_operations: jsonb -> typed columns,
-- with null-safe cast for exchange_rate (numeric). original_amount stays text
-- (AES-256-GCM ciphertext, no cast). Coherence enforced by fx_metadata_coherent
-- CHECK constraint (migration 20260420120000).

CREATE OR REPLACE FUNCTION public.create_template_with_lines(
  p_user_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_is_default boolean DEFAULT false,
  p_lines jsonb DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  new_template_id uuid;
  line_record jsonb;
  result json;
BEGIN
  INSERT INTO public.template (user_id, name, description, is_default)
  VALUES (p_user_id, p_name, p_description, p_is_default)
  RETURNING id INTO new_template_id;

  IF p_lines IS NOT NULL THEN
    FOR line_record IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      INSERT INTO public.template_line (
        template_id,
        name,
        amount,
        kind,
        recurrence,
        description,
        original_amount,
        original_currency,
        target_currency,
        exchange_rate
      ) VALUES (
        new_template_id,
        line_record->>'name',
        line_record->>'amount',
        (line_record->>'kind')::public.transaction_kind,
        (line_record->>'recurrence')::public.transaction_recurrence,
        line_record->>'description',
        line_record->>'original_amount',
        line_record->>'original_currency',
        line_record->>'target_currency',
        CASE
          WHEN (line_record->>'exchange_rate') IS NULL
            OR (line_record->>'exchange_rate') = ''
          THEN NULL
          ELSE (line_record->>'exchange_rate')::numeric
        END
      );
    END LOOP;
  END IF;

  SELECT json_build_object(
    'id', t.id,
    'user_id', t.user_id,
    'name', t.name,
    'description', t.description,
    'is_default', t.is_default,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'template_lines', COALESCE(
      (SELECT json_agg(json_build_object(
        'id', tl.id,
        'template_id', tl.template_id,
        'name', tl.name,
        'amount', tl.amount,
        'kind', tl.kind,
        'recurrence', tl.recurrence,
        'description', tl.description,
        'original_amount', tl.original_amount,
        'original_currency', tl.original_currency,
        'target_currency', tl.target_currency,
        'exchange_rate', tl.exchange_rate,
        'created_at', tl.created_at,
        'updated_at', tl.updated_at
      ) ORDER BY tl.created_at)
      FROM public.template_line tl
      WHERE tl.template_id = new_template_id),
      '[]'::json
    )
  ) INTO result
  FROM public.template t
  WHERE t.id = new_template_id;

  RETURN result;
END;
$$;

ALTER FUNCTION public.create_template_with_lines(uuid, text, text, boolean, jsonb) OWNER TO postgres;
