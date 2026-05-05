-- Migration: propagate currency metadata columns into budget_line
-- via create_budget_from_template and apply_template_line_operations.
--
-- The columns original_amount, original_currency, target_currency, exchange_rate
-- were added in 20260306120000_add_currency_metadata_columns but the RPCs that
-- materialize budget_lines from template_lines were never updated. Without this
-- migration, every budget generated from a multi-currency template silently
-- loses all four FX columns — the CurrencyConversionBadge never renders and
-- subsequent rekeys have nothing to re-encrypt.

-- ============================================================
-- 1. create_budget_from_template — copy FX columns from template_line
-- ============================================================
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
    AND (user_id = p_user_id OR user_id IS NULL);

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

-- ============================================================
-- 2. apply_template_line_operations — propagate FX on updates + creates
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_template_line_operations(
  template_id uuid,
  budget_ids uuid[] DEFAULT ARRAY[]::uuid[],
  delete_ids uuid[] DEFAULT ARRAY[]::uuid[],
  updated_lines jsonb DEFAULT '[]'::jsonb,
  created_lines jsonb DEFAULT '[]'::jsonb
) RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_template_id uuid := template_id;
  v_budget_ids uuid[] := COALESCE(budget_ids, ARRAY[]::uuid[]);
  v_delete_ids uuid[] := COALESCE(delete_ids, ARRAY[]::uuid[]);
  v_updated_lines jsonb := COALESCE(updated_lines, '[]'::jsonb);
  v_created_lines jsonb := COALESCE(created_lines, '[]'::jsonb);
  v_impacted uuid[] := ARRAY[]::uuid[];
  v_new_ids uuid[];
  v_update record;
  v_create record;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.template t
    WHERE t.id = v_template_id
      AND t.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Template % not found or access denied', v_template_id
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(array_length(v_budget_ids, 1), 0) > 0 THEN

    IF COALESCE(array_length(v_delete_ids, 1), 0) > 0 THEN
      WITH deleted_budget_lines AS (
        DELETE FROM public.budget_line bl
        WHERE bl.template_line_id = ANY(v_delete_ids)
          AND bl.is_manually_adjusted = false
          AND bl.budget_id = ANY(v_budget_ids)
        RETURNING bl.budget_id
      )
      SELECT COALESCE(array_agg(DISTINCT budget_id), ARRAY[]::uuid[])
      INTO v_new_ids
      FROM deleted_budget_lines;

      IF v_new_ids IS NOT NULL THEN
        v_impacted := array_cat(v_impacted, v_new_ids);
      END IF;
    END IF;

    FOR v_update IN
      SELECT
        (line->>'id')::uuid AS id,
        line->>'name' AS name,
        line->>'amount' AS amount,
        (line->>'kind')::public.transaction_kind AS kind,
        (line->>'recurrence')::public.transaction_recurrence AS recurrence,
        line->>'original_amount' AS original_amount,
        line->>'original_currency' AS original_currency,
        line->>'target_currency' AS target_currency,
        CASE
          WHEN (line->>'exchange_rate') IS NULL
            OR (line->>'exchange_rate') = ''
          THEN NULL
          ELSE (line->>'exchange_rate')::numeric
        END AS exchange_rate
      FROM jsonb_array_elements(v_updated_lines) AS line
    LOOP
      WITH updated_budget_lines AS (
        UPDATE public.budget_line bl
        SET
          name = v_update.name,
          amount = v_update.amount,
          kind = v_update.kind,
          recurrence = v_update.recurrence,
          original_amount = v_update.original_amount,
          original_currency = v_update.original_currency,
          target_currency = v_update.target_currency,
          exchange_rate = v_update.exchange_rate,
          updated_at = NOW()
        WHERE bl.template_line_id = v_update.id
          AND bl.is_manually_adjusted = false
          AND bl.budget_id = ANY(v_budget_ids)
        RETURNING bl.budget_id
      )
      SELECT COALESCE(array_agg(DISTINCT budget_id), ARRAY[]::uuid[])
      INTO v_new_ids
      FROM updated_budget_lines;

      IF v_new_ids IS NOT NULL THEN
        v_impacted := array_cat(v_impacted, v_new_ids);
      END IF;
    END LOOP;

    FOR v_create IN
      SELECT
        (line->>'id')::uuid AS id,
        line->>'name' AS name,
        line->>'amount' AS amount,
        (line->>'kind')::public.transaction_kind AS kind,
        (line->>'recurrence')::public.transaction_recurrence AS recurrence,
        line->>'original_amount' AS original_amount,
        line->>'original_currency' AS original_currency,
        line->>'target_currency' AS target_currency,
        CASE
          WHEN (line->>'exchange_rate') IS NULL
            OR (line->>'exchange_rate') = ''
          THEN NULL
          ELSE (line->>'exchange_rate')::numeric
        END AS exchange_rate
      FROM jsonb_array_elements(v_created_lines) AS line
    LOOP
      WITH inserted_budget_lines AS (
        INSERT INTO public.budget_line (
          budget_id,
          template_line_id,
          name,
          amount,
          recurrence,
          is_manually_adjusted,
          kind,
          original_amount,
          original_currency,
          target_currency,
          exchange_rate,
          created_at,
          updated_at
        )
        SELECT
          bid,
          v_create.id,
          v_create.name,
          v_create.amount,
          v_create.recurrence,
          false,
          v_create.kind,
          v_create.original_amount,
          v_create.original_currency,
          v_create.target_currency,
          v_create.exchange_rate,
          NOW(),
          NOW()
        FROM unnest(v_budget_ids) AS bid
        RETURNING budget_id
      )
      SELECT COALESCE(array_agg(DISTINCT budget_id), ARRAY[]::uuid[])
      INTO v_new_ids
      FROM inserted_budget_lines;

      IF v_new_ids IS NOT NULL THEN
        v_impacted := array_cat(v_impacted, v_new_ids);
      END IF;
    END LOOP;

  END IF;

  IF COALESCE(array_length(v_delete_ids, 1), 0) > 0 THEN
    DELETE FROM public.template_line tl
    WHERE tl.template_id = v_template_id
      AND tl.id = ANY(v_delete_ids);
  END IF;

  RETURN (
    SELECT COALESCE(array_agg(DISTINCT budget_id), ARRAY[]::uuid[])
    FROM (
      SELECT DISTINCT unnest(v_impacted) AS budget_id
    ) aggregated
  );
END;
$$;

ALTER FUNCTION public.apply_template_line_operations(uuid, uuid[], uuid[], jsonb, jsonb) OWNER TO postgres;
