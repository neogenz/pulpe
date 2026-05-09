-- Migration: make apply_template_line_operations atomic over template-side writes.
--
-- Background: prior to this migration the template-line bulk flow performed
-- three sequential writes from NestJS:
--   1. supabase.from('template_line').update(...) per updated line
--   2. supabase.from('template_line').insert(...) per created line
--   3. supabase.rpc('apply_template_line_operations', ...) (deletes + budget propagation)
-- Each individual statement committed independently. If step 3 failed after
-- steps 1 and 2 succeeded, the template ended up in a corrupt half-state and
-- budget propagation never ran. There was no rollback path.
--
-- This migration absorbs the template-line UPDATE and INSERT into the RPC
-- itself. All four operations (template UPDATE, template INSERT, budget
-- propagation, template DELETE) now execute inside a single Postgres function
-- call which provides implicit transaction semantics. A failure at any point
-- rolls back every preceding write.
--
-- Caller responsibility:
--   - `created_lines[].id` MUST be a caller-generated UUID (NestJS uses
--     `crypto.randomUUID()`). The RPC inserts the row with that exact id so
--     the budget-line propagation can reference it as `template_line_id`
--     without a second SELECT round-trip.
--   - `updated_lines[].id` MUST refer to an existing template_line row owned
--     by the calling user's template (validated up front).
--
-- Return shape unchanged: affected budget IDs as `uuid[]`. The caller fetches
-- updated/created template_line rows back via a follow-up SELECT (read-only,
-- runs after the atomic write commits).

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

  -- 1. UPDATE template_line rows from updated_lines payload (partial patch
  --    semantics — only fields present in the JSONB are written).
  --    Restrict to lines belonging to this template (defense in depth on top
  --    of RLS — the function runs SECURITY DEFINER so RLS is bypassed).
  FOR v_update IN
    SELECT line FROM jsonb_array_elements(v_updated_lines) AS line
  LOOP
    UPDATE public.template_line tl
    SET
      name = CASE
        WHEN v_update.line ? 'name'
        THEN v_update.line->>'name'
        ELSE tl.name
      END,
      amount = CASE
        WHEN v_update.line ? 'amount'
        THEN v_update.line->>'amount'
        ELSE tl.amount
      END,
      kind = CASE
        WHEN v_update.line ? 'kind'
        THEN (v_update.line->>'kind')::public.transaction_kind
        ELSE tl.kind
      END,
      recurrence = CASE
        WHEN v_update.line ? 'recurrence'
        THEN (v_update.line->>'recurrence')::public.transaction_recurrence
        ELSE tl.recurrence
      END,
      original_amount = CASE
        WHEN v_update.line ? 'original_amount'
        THEN v_update.line->>'original_amount'
        ELSE tl.original_amount
      END,
      original_currency = CASE
        WHEN v_update.line ? 'original_currency'
        THEN v_update.line->>'original_currency'
        ELSE tl.original_currency
      END,
      target_currency = CASE
        WHEN v_update.line ? 'target_currency'
        THEN v_update.line->>'target_currency'
        ELSE tl.target_currency
      END,
      exchange_rate = CASE
        WHEN v_update.line ? 'exchange_rate'
        THEN CASE
          WHEN (v_update.line->>'exchange_rate') IS NULL
            OR (v_update.line->>'exchange_rate') = ''
          THEN NULL
          ELSE (v_update.line->>'exchange_rate')::numeric
        END
        ELSE tl.exchange_rate
      END,
      description = CASE
        WHEN v_update.line ? 'description'
        THEN v_update.line->>'description'
        ELSE tl.description
      END,
      updated_at = NOW()
    WHERE tl.id = (v_update.line->>'id')::uuid
      AND tl.template_id = v_template_id;
  END LOOP;

  -- 2. INSERT template_line rows from created_lines payload. Caller-supplied
  --    `id` is used so the subsequent budget-line propagation can join on it.
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
      line->>'description' AS description,
      CASE
        WHEN (line->>'exchange_rate') IS NULL
          OR (line->>'exchange_rate') = ''
        THEN NULL
        ELSE (line->>'exchange_rate')::numeric
      END AS exchange_rate
    FROM jsonb_array_elements(v_created_lines) AS line
  LOOP
    INSERT INTO public.template_line (
      id, template_id, name, amount, kind, recurrence,
      original_amount, original_currency, target_currency, exchange_rate,
      description
    ) VALUES (
      v_create.id, v_template_id, v_create.name, v_create.amount,
      v_create.kind, v_create.recurrence,
      v_create.original_amount, v_create.original_currency,
      v_create.target_currency, v_create.exchange_rate,
      v_create.description
    );
  END LOOP;

  -- 3. Propagate to budget_line when caller passed at least one budget.
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
      SELECT line FROM jsonb_array_elements(v_updated_lines) AS line
    LOOP
      WITH updated_budget_lines AS (
        UPDATE public.budget_line bl
        SET
          name = CASE
            WHEN v_update.line ? 'name'
            THEN v_update.line->>'name'
            ELSE bl.name
          END,
          amount = CASE
            WHEN v_update.line ? 'amount'
            THEN v_update.line->>'amount'
            ELSE bl.amount
          END,
          kind = CASE
            WHEN v_update.line ? 'kind'
            THEN (v_update.line->>'kind')::public.transaction_kind
            ELSE bl.kind
          END,
          recurrence = CASE
            WHEN v_update.line ? 'recurrence'
            THEN (v_update.line->>'recurrence')::public.transaction_recurrence
            ELSE bl.recurrence
          END,
          original_amount = CASE
            WHEN v_update.line ? 'original_amount'
            THEN v_update.line->>'original_amount'
            ELSE bl.original_amount
          END,
          original_currency = CASE
            WHEN v_update.line ? 'original_currency'
            THEN v_update.line->>'original_currency'
            ELSE bl.original_currency
          END,
          target_currency = CASE
            WHEN v_update.line ? 'target_currency'
            THEN v_update.line->>'target_currency'
            ELSE bl.target_currency
          END,
          exchange_rate = CASE
            WHEN v_update.line ? 'exchange_rate'
            THEN CASE
              WHEN (v_update.line->>'exchange_rate') IS NULL
                OR (v_update.line->>'exchange_rate') = ''
              THEN NULL
              ELSE (v_update.line->>'exchange_rate')::numeric
            END
            ELSE bl.exchange_rate
          END,
          updated_at = NOW()
        WHERE bl.template_line_id = (v_update.line->>'id')::uuid
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

  -- 4. DELETE template_line rows last so budget-line propagation step 3
  --    could still observe them via the FK chain.
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
