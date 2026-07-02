-- PUL-12 — propagate template_line.savings_goal_id through the budget write paths.
--
-- Two SECURITY DEFINER RPCs learn the new link column:
--   1. apply_template_line_operations (RG-001 sync): copies savings_goal_id on
--      every template_line UPDATE/INSERT and propagates it to non-manually-
--      adjusted budget_line rows (UPDATE/INSERT).
--   2. create_budget_from_template (initial generation): copies
--      template_line.savings_goal_id into the generated budget_line.
--
-- `(payload->>'savings_goal_id')::uuid` maps JSON null AND absent key to SQL NULL
-- (untag), `? 'savings_goal_id'` preserves partial-patch semantics on UPDATE.
--
-- The PUL-272 cross-tenant budget-ownership guard is column-independent and is
-- reproduced BYTE-FOR-BYTE below. The kind != saving => savings_goal_id = null
-- rule (SAVINGS.md §3.4) is enforced in the use-case before the payload reaches
-- these RPCs — the RPC stays a faithful writer of what it is given.

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

  -- PUL-272: cross-tenant write guard. SECURITY DEFINER bypasses RLS, so budget
  -- ownership must be enforced explicitly here — template ownership above does
  -- NOT imply the caller owns the budgets in budget_ids. Every budget must
  -- belong to the caller; otherwise an authenticated user could pass another
  -- user's budget_id (direct PostgREST call) and inject/mutate their budget_line
  -- rows. unnest of an empty array yields no rows, so the template-only path
  -- (no propagation) passes unaffected.
  IF EXISTS (
    SELECT 1
    FROM unnest(v_budget_ids) AS b(id)
    LEFT JOIN public.monthly_budget mb
      ON mb.id = b.id AND mb.user_id = (SELECT auth.uid())
    WHERE mb.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Budget access denied'
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
      savings_goal_id = CASE
        WHEN v_update.line ? 'savings_goal_id'
        THEN (v_update.line->>'savings_goal_id')::uuid
        ELSE tl.savings_goal_id
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
      (line->>'savings_goal_id')::uuid AS savings_goal_id,
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
      id, template_id, name, amount, kind, recurrence, savings_goal_id,
      original_amount, original_currency, target_currency, exchange_rate,
      description
    ) VALUES (
      v_create.id, v_template_id, v_create.name, v_create.amount,
      v_create.kind, v_create.recurrence, v_create.savings_goal_id,
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
          savings_goal_id = CASE
            WHEN v_update.line ? 'savings_goal_id'
            THEN (v_update.line->>'savings_goal_id')::uuid
            ELSE bl.savings_goal_id
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
        (line->>'savings_goal_id')::uuid AS savings_goal_id,
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
          savings_goal_id,
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
          v_create.savings_goal_id,
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

-- PUL-272 belt-and-suspenders: re-assert the scoped EXECUTE grant (CREATE OR
-- REPLACE preserves privileges, but keep the migration self-contained).
REVOKE EXECUTE ON FUNCTION public.apply_template_line_operations(uuid, uuid[], uuid[], jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_template_line_operations(uuid, uuid[], uuid[], jsonb, jsonb) TO authenticated, service_role;

-- ── create_budget_from_template: copy savings_goal_id into the generated budget ──
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
           tl.savings_goal_id,
           tl.original_amount, tl.original_currency, tl.target_currency, tl.exchange_rate
    FROM public.template_line tl
    WHERE tl.template_id = p_template_id
    ORDER BY tl.created_at
  LOOP
    INSERT INTO public.budget_line (
      budget_id, template_line_id, amount, kind, recurrence, name, savings_goal_id,
      original_amount, original_currency, target_currency, exchange_rate
    ) VALUES (
      new_budget_id,
      template_line_record.id,
      template_line_record.amount,
      template_line_record.kind,
      template_line_record.recurrence,
      template_line_record.name,
      template_line_record.savings_goal_id,
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
