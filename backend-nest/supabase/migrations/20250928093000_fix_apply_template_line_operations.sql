-- Update function to avoid ambiguous references when using template_id parameter

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
  -- Ensure template exists and belongs to current user
  IF NOT EXISTS (
    SELECT 1
    FROM public.template t
    WHERE t.id = v_template_id
      AND t.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Template % not found or access denied', v_template_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Propagate operations to budgets when relevant
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
        (line->>'amount')::numeric AS amount,
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
        (line->>'amount')::numeric AS amount,
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
          budget_id,
          v_create.id,
          v_create.name,
          v_create.amount,
          v_create.recurrence,
          false,
          v_create.kind,
          NOW(),
          NOW()
        FROM unnest(v_budget_ids) AS budget_id
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

  -- Always delete template lines at the end
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
