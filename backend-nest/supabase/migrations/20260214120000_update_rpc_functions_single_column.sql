-- Migration: Update RPC functions after dual-column → single-column cleanup
-- Removes all references to dropped amount_encrypted columns and
-- removes ::numeric casts since amount is now text (AES-256-GCM ciphertext).

-- ============================================================
-- 1. Update create_budget_from_template
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
    SELECT tl.id, tl.amount, tl.kind, tl.recurrence, tl.name, tl.description
    FROM public.template_line tl
    WHERE tl.template_id = p_template_id
    ORDER BY tl.created_at
  LOOP
    INSERT INTO public.budget_line (
      budget_id, template_line_id, amount, kind, recurrence, name
    ) VALUES (
      new_budget_id,
      template_line_record.id,
      template_line_record.amount,
      template_line_record.kind,
      template_line_record.recurrence,
      template_line_record.name
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
-- 2. Update create_template_with_lines
-- ============================================================
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
        description
      ) VALUES (
        new_template_id,
        line_record->>'name',
        line_record->>'amount',
        (line_record->>'kind')::public.transaction_kind,
        (line_record->>'recurrence')::public.transaction_recurrence,
        line_record->>'description'
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

-- ============================================================
-- 3. Update bulk_update_template_lines
-- ============================================================
DROP FUNCTION IF EXISTS public.bulk_update_template_lines(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.bulk_update_template_lines(
  p_template_id uuid,
  line_updates jsonb
) RETURNS TABLE(
  id uuid,
  template_id uuid,
  name text,
  amount text,
  kind public.transaction_kind,
  recurrence public.transaction_recurrence,
  description text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  line_update JSONB;
  updated_count INTEGER := 0;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.template t
    WHERE t.id = p_template_id
    AND t.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Template not found or access denied'
      USING ERRCODE = 'P0001';
  END IF;

  FOR line_update IN SELECT * FROM jsonb_array_elements(line_updates)
  LOOP
    IF NOT EXISTS(
      SELECT 1 FROM public.template_line tl
      WHERE tl.id = (line_update->>'id')::UUID
      AND tl.template_id = p_template_id
    ) THEN
      RAISE EXCEPTION 'Template line % not found or does not belong to template %',
        line_update->>'id', p_template_id
        USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.template_line
    SET
      name = CASE
        WHEN line_update->>'name' IS NOT NULL THEN (line_update->>'name')::TEXT
        ELSE public.template_line.name
      END,
      amount = CASE
        WHEN line_update ? 'amount' THEN (line_update->>'amount')::TEXT
        ELSE public.template_line.amount
      END,
      kind = CASE
        WHEN line_update->>'kind' IS NOT NULL THEN (line_update->>'kind')::public.transaction_kind
        ELSE public.template_line.kind
      END,
      recurrence = CASE
        WHEN line_update->>'recurrence' IS NOT NULL THEN (line_update->>'recurrence')::public.transaction_recurrence
        ELSE public.template_line.recurrence
      END,
      description = CASE
        WHEN line_update->>'description' IS NOT NULL THEN (line_update->>'description')::TEXT
        ELSE public.template_line.description
      END,
      updated_at = NOW()
    WHERE
      public.template_line.id = (line_update->>'id')::UUID
      AND public.template_line.template_id = p_template_id;

    updated_count := updated_count + 1;
  END LOOP;

  RETURN QUERY
  SELECT
    tl.id,
    tl.template_id,
    tl.name,
    tl.amount,
    tl.kind,
    tl.recurrence,
    COALESCE(tl.description, '') as description,
    tl.created_at,
    tl.updated_at
  FROM public.template_line tl
  WHERE tl.template_id = p_template_id
  ORDER BY tl.created_at;
END;
$$;

ALTER FUNCTION public.bulk_update_template_lines(uuid, jsonb) OWNER TO postgres;

-- ============================================================
-- 4. Update apply_template_line_operations
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
        (line->>'recurrence')::public.transaction_recurrence AS recurrence
      FROM jsonb_array_elements(v_updated_lines) AS line
    LOOP
      WITH updated_budget_lines AS (
        UPDATE public.budget_line bl
        SET
          name = v_update.name,
          amount = v_update.amount,
          kind = v_update.kind,
          recurrence = v_update.recurrence,
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
        (line->>'recurrence')::public.transaction_recurrence AS recurrence
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
