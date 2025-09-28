-- Migration to remove 'variable' from transaction_recurrence enum
-- and convert existing 'variable' records to 'one_off'

-- 1. First, migrate existing data from 'variable' to 'one_off'
UPDATE budget_line
SET recurrence = 'one_off'
WHERE recurrence = 'variable';

UPDATE template_line
SET recurrence = 'one_off'
WHERE recurrence = 'variable';

-- 2. Create new enum without 'variable'
ALTER TYPE transaction_recurrence RENAME TO transaction_recurrence_old;

CREATE TYPE transaction_recurrence AS ENUM (
  'fixed',
  'one_off'
);

-- 3. Update budget_line table to use new enum
ALTER TABLE budget_line
ALTER COLUMN recurrence TYPE transaction_recurrence
USING recurrence::text::transaction_recurrence;

-- 4. Update template_line table to use new enum
ALTER TABLE template_line
ALTER COLUMN recurrence TYPE transaction_recurrence
USING recurrence::text::transaction_recurrence;

-- 4.5. Recreate the bulk_update_template_lines function with the new enum type
-- This is necessary because the function signature references the old type
DROP FUNCTION IF EXISTS bulk_update_template_lines;
CREATE OR REPLACE FUNCTION "public"."bulk_update_template_lines"("p_template_id" "uuid", "line_updates" "jsonb") RETURNS TABLE("id" "uuid", "template_id" "uuid", "name" "text", "amount" numeric, "kind" "public"."transaction_kind", "recurrence" "public"."transaction_recurrence", "description" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  line_update JSONB;
  updated_count INTEGER := 0;
BEGIN
  -- Validate that template exists and belongs to authenticated user
  IF NOT EXISTS(
    SELECT 1 FROM public.template t
    WHERE t.id = p_template_id
    AND t.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Template not found or access denied'
      USING ERRCODE = 'P0001';
  END IF;

  -- Process each line update atomically
  FOR line_update IN SELECT * FROM jsonb_array_elements(line_updates)
  LOOP
    -- Validate that the line exists and belongs to the template
    IF NOT EXISTS(
      SELECT 1 FROM public.template_line tl
      WHERE tl.id = (line_update->>'id')::UUID
      AND tl.template_id = p_template_id
    ) THEN
      RAISE EXCEPTION 'Template line % not found or does not belong to template %',
        line_update->>'id', p_template_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Update the template line with proper type casting
    -- Use CASE statements to avoid COALESCE type mismatch issues
    UPDATE public.template_line
    SET
      name = CASE
        WHEN line_update->>'name' IS NOT NULL THEN (line_update->>'name')::TEXT
        ELSE public.template_line.name
      END,
      amount = CASE
        WHEN line_update->>'amount' IS NOT NULL THEN (line_update->>'amount')::NUMERIC
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

  -- Return all updated template lines
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

-- Set proper function ownership
ALTER FUNCTION "public"."bulk_update_template_lines"("uuid", "jsonb") OWNER TO "postgres";

-- 5. Drop the old enum type
DROP TYPE transaction_recurrence_old;

-- 6. Verify the migration worked (this will show counts by recurrence type)
-- Comment: After migration, only 'fixed' and 'one_off' should remain
SELECT
  'budget_line' as table_name,
  recurrence,
  COUNT(*) as count
FROM budget_line
GROUP BY recurrence

UNION ALL

SELECT
  'template_line' as table_name,
  recurrence,
  COUNT(*) as count
FROM template_line
GROUP BY recurrence
ORDER BY table_name, recurrence;