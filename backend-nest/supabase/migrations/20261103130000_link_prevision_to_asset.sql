-- pulpe:migration-phase contract
-- pulpe:safe-after v0.59.0
-- Mon patrimoine: a prévision (budget_line and template_line) can link to an
-- asset, beside its savings goal and independent from it.
--
-- Contract only because the foreign keys are inline, which the expand checker
-- refuses; nothing deployed reads or writes `asset_id` yet.
--
-- 1. The column, its foreign key (deleting an asset unlinks the lines, never
--    deletes them) and its index.
-- 2. The trigger that guards the link: the asset belongs to the line's owner
--    and its direction matches the kind (saving and income -> own, expense ->
--    owe). Modelled on enforce_savings_goal_line_link.
-- 3. The RPCs that copy or rewrite prévision columns carry `asset_id` beside
--    `savings_goal_id`. Their bodies come from the live database, not from the
--    earlier migrations: 20260814122000 later switched some to SECURITY
--    INVOKER, and CREATE OR REPLACE resets the security mode and the search
--    path, so both are restated. Grants are untouched. The generation RPC
--    (generate_budgets_from_template) has no column list: it delegates to
--    create_budget_from_template.

-- ---------------------------------------------------------------------------
-- 1. Column, foreign key, index
-- ---------------------------------------------------------------------------

ALTER TABLE public.budget_line
  ADD COLUMN asset_id uuid REFERENCES public.asset (id) ON DELETE SET NULL;
ALTER TABLE public.template_line
  ADD COLUMN asset_id uuid REFERENCES public.asset (id) ON DELETE SET NULL;

-- Serves the ON DELETE SET NULL scan when an asset is deleted.
CREATE INDEX idx_budget_line_asset_id
  ON public.budget_line (asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX idx_template_line_asset_id
  ON public.template_line (asset_id) WHERE asset_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Guard trigger
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so the owner comparison sees the asset whatever the caller's
-- RLS shows; a foreign or deleted asset is refused as 'Asset access denied'.
CREATE OR REPLACE FUNCTION public.enforce_asset_line_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_owner_id uuid;
  v_direction text;
BEGIN
  IF NEW.asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'budget_line' THEN
    SELECT mb.user_id
    INTO v_owner_id
    FROM public.monthly_budget mb
    WHERE mb.id = NEW.budget_id;
  ELSIF TG_TABLE_NAME = 'template_line' THEN
    SELECT t.user_id
    INTO v_owner_id
    FROM public.template t
    WHERE t.id = NEW.template_id;
  ELSE
    RAISE EXCEPTION 'Unsupported asset link table: %', TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;

  SELECT a.direction
  INTO v_direction
  FROM public.asset a
  WHERE a.id = NEW.asset_id
    AND a.user_id = v_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset access denied'
      USING ERRCODE = 'P0001';
  END IF;

  -- Only an expense links to a debt.
  IF (v_direction = 'owe')
    IS DISTINCT FROM (NEW.kind = 'expense'::public.transaction_kind)
  THEN
    RAISE EXCEPTION 'Asset direction does not match the line kind'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_asset_line_link() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_asset_line_link()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_budget_line_asset_link
  BEFORE INSERT OR UPDATE OF asset_id, kind, budget_id ON public.budget_line
  FOR EACH ROW EXECUTE FUNCTION public.enforce_asset_line_link();
CREATE TRIGGER enforce_template_line_asset_link
  BEFORE INSERT OR UPDATE OF asset_id, kind, template_id ON public.template_line
  FOR EACH ROW EXECUTE FUNCTION public.enforce_asset_line_link();

-- ---------------------------------------------------------------------------
-- 3. RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_budget_from_template(p_user_id uuid, p_template_id uuid, p_month integer, p_year integer, p_description text, p_excluded_savings_goal_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  new_budget_id uuid;
  new_budget_line_id uuid;
  template_record record;
  template_line_record record;
  budget_line_count integer := 0;
  excluded_goal_ids uuid[] := COALESCE(p_excluded_savings_goal_ids, '{}'::uuid[]);
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
           tl.savings_goal_id, tl.asset_id,
           tl.original_amount, tl.original_currency, tl.target_currency, tl.exchange_rate
    FROM public.template_line tl
    LEFT JOIN public.savings_goal sg ON sg.id = tl.savings_goal_id
    WHERE tl.template_id = p_template_id
      AND (
        tl.savings_goal_id IS NULL
        OR (
          sg.status = 'ACTIVE'
          AND NOT (tl.savings_goal_id = ANY(excluded_goal_ids))
        )
      )
    ORDER BY tl.created_at
  LOOP
    INSERT INTO public.budget_line (
      budget_id, template_line_id, amount, kind, recurrence, name, savings_goal_id,
      asset_id, original_amount, original_currency, target_currency, exchange_rate
    ) VALUES (
      new_budget_id,
      template_line_record.id,
      template_line_record.amount,
      template_line_record.kind,
      template_line_record.recurrence,
      template_line_record.name,
      template_line_record.savings_goal_id,
      template_line_record.asset_id,
      template_line_record.original_amount,
      template_line_record.original_currency,
      template_line_record.target_currency,
      template_line_record.exchange_rate
    )
    RETURNING id INTO new_budget_line_id;

    INSERT INTO public.budget_line_tag (budget_line_id, tag_id)
    SELECT new_budget_line_id, tlt.tag_id
    FROM public.template_line_tag tlt
    WHERE tlt.template_line_id = template_line_record.id;

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
$function$;

CREATE OR REPLACE FUNCTION public.apply_template_line_operations(template_id uuid, budget_ids uuid[] DEFAULT ARRAY[]::uuid[], delete_ids uuid[] DEFAULT ARRAY[]::uuid[], updated_lines jsonb DEFAULT '[]'::jsonb, created_lines jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
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
      asset_id = CASE
        WHEN v_update.line ? 'asset_id'
        THEN (v_update.line->>'asset_id')::uuid
        ELSE tl.asset_id
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
      (line->>'asset_id')::uuid AS asset_id,
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
      asset_id,
      original_amount, original_currency, target_currency, exchange_rate,
      description
    ) VALUES (
      v_create.id, v_template_id, v_create.name, v_create.amount,
      v_create.kind, v_create.recurrence, v_create.savings_goal_id,
      v_create.asset_id,
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
      SELECT
        line,
        COALESCE(
          ARRAY(
            SELECT excluded_budget_id::uuid
            FROM jsonb_array_elements_text(
              COALESCE(line->'excluded_budget_ids', '[]'::jsonb)
            ) AS excluded_budget_id
          ),
          ARRAY[]::uuid[]
        ) AS excluded_budget_ids
      FROM jsonb_array_elements(v_updated_lines) AS line
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
              AND NOT (bl.budget_id = ANY(v_update.excluded_budget_ids))
            THEN (v_update.line->>'savings_goal_id')::uuid
            ELSE bl.savings_goal_id
          END,
          asset_id = CASE
            WHEN v_update.line ? 'asset_id'
            THEN (v_update.line->>'asset_id')::uuid
            ELSE bl.asset_id
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
        (line->>'asset_id')::uuid AS asset_id,
        line->>'original_amount' AS original_amount,
        line->>'original_currency' AS original_currency,
        line->>'target_currency' AS target_currency,
        CASE
          WHEN (line->>'exchange_rate') IS NULL
            OR (line->>'exchange_rate') = ''
          THEN NULL
          ELSE (line->>'exchange_rate')::numeric
        END AS exchange_rate,
        COALESCE(
          ARRAY(
            SELECT excluded_budget_id::uuid
            FROM jsonb_array_elements_text(
              COALESCE(line->'excluded_budget_ids', '[]'::jsonb)
            ) AS excluded_budget_id
          ),
          ARRAY[]::uuid[]
        ) AS excluded_budget_ids
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
          asset_id,
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
          v_create.asset_id,
          v_create.original_amount,
          v_create.original_currency,
          v_create.target_currency,
          v_create.exchange_rate,
          NOW(),
          NOW()
        FROM unnest(v_budget_ids) AS bid
        WHERE NOT (bid = ANY(v_create.excluded_budget_ids))
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
$function$;

CREATE OR REPLACE FUNCTION public.create_budget_lines_spread(p_spread_group_id uuid, p_lines jsonb DEFAULT '[]'::jsonb, p_source_budget_line_id uuid DEFAULT NULL::uuid, p_source_transaction_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF public.budget_line
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_deleted_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency guard (PUL-17). Serialize same-key callers, then reject a group
  -- that already exists so a retry replays instead of inserting a duplicate. The
  -- advisory lock is namespaced to this function and released at transaction end.
  PERFORM pg_advisory_xact_lock(
    hashtext('create_budget_lines_spread'),
    hashtext(p_spread_group_id::text)
  );
  IF EXISTS (
    SELECT 1 FROM public.budget_line WHERE spread_group_id = p_spread_group_id
  ) THEN
    RAISE EXCEPTION 'Spread group already exists' USING ERRCODE = 'P0001';
  END IF;

  IF num_nonnulls(p_source_budget_line_id, p_source_transaction_id) > 1 THEN
    RAISE EXCEPTION 'Exactly one spread source type is allowed'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_lines) AS l(budget_id uuid)
    LEFT JOIN public.monthly_budget mb
      ON mb.id = l.budget_id AND mb.user_id = v_uid
    WHERE mb.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Budget access denied' USING ERRCODE = 'P0001';
  END IF;

  -- Defense in depth: a source-backed spread with no target lines would delete
  -- the source then insert nothing. The use case guards this; the RPC must too.
  IF num_nonnulls(p_source_budget_line_id, p_source_transaction_id) = 1
     AND jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Spread source provided with no target lines'
      USING ERRCODE = 'P0001';
  END IF;

  -- Consume the source before INSERT. Concurrent calls serialize on DELETE;
  -- only the first can observe ROW_COUNT = 1 and proceed to the fan-out.
  IF p_source_budget_line_id IS NOT NULL THEN
    DELETE FROM public.budget_line bl
    WHERE bl.id = p_source_budget_line_id
      AND EXISTS (
        SELECT 1
        FROM public.monthly_budget mb
        WHERE mb.id = bl.budget_id AND mb.user_id = v_uid
      );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    IF v_deleted_count <> 1 THEN
      RAISE EXCEPTION 'Spread source unavailable' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_source_transaction_id IS NOT NULL THEN
    DELETE FROM public.transaction t
    WHERE t.id = p_source_transaction_id
      AND EXISTS (
        SELECT 1
        FROM public.monthly_budget mb
        WHERE mb.id = t.budget_id AND mb.user_id = v_uid
      );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    IF v_deleted_count <> 1 THEN
      RAISE EXCEPTION 'Spread source unavailable' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN QUERY
  INSERT INTO public.budget_line (
    budget_id,
    name,
    amount,
    kind,
    recurrence,
    spread_group_id,
    savings_goal_id,
    asset_id,
    original_amount,
    original_currency,
    target_currency,
    exchange_rate,
    is_manually_adjusted,
    created_at,
    updated_at
  )
  SELECT
    l.budget_id,
    l.name,
    l.amount,
    l.kind::public.transaction_kind,
    l.recurrence::public.transaction_recurrence,
    p_spread_group_id,
    l.savings_goal_id,
    l.asset_id,
    l.original_amount,
    l.original_currency,
    l.target_currency,
    CASE
      WHEN l.exchange_rate IS NULL OR l.exchange_rate = '' THEN NULL
      ELSE l.exchange_rate::numeric
    END,
    false,
    NOW(),
    NOW()
  FROM jsonb_to_recordset(p_lines) AS l(
    budget_id uuid,
    name text,
    amount text,
    kind text,
    recurrence text,
    savings_goal_id uuid,
    asset_id uuid,
    original_amount text,
    original_currency text,
    target_currency text,
    exchange_rate text
  )
  RETURNING *;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_template_with_lines(p_user_id uuid, p_name text, p_description text DEFAULT NULL::text, p_is_default boolean DEFAULT false, p_lines jsonb DEFAULT NULL::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  new_template_id uuid;
  new_template_line_id uuid;
  line_record jsonb;
  result json;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Template creation denied: access not allowed'
      USING ERRCODE = 'P0001';
  END IF;

  -- SECURITY DEFINER bypasses RLS. Reject every missing/foreign tag before the
  -- template insert so no cross-tenant junction can ever be attempted.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
      AS line_item(value)
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(line_item.value->'tag_ids', '[]'::jsonb)
    ) AS requested_tag(value)
    LEFT JOIN public.tag owned_tag
      ON owned_tag.id = requested_tag.value::uuid
      AND owned_tag.user_id = p_user_id
    WHERE owned_tag.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Tag access denied'
      USING ERRCODE = 'P0001';
  END IF;

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
        savings_goal_id,
        asset_id,
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
        (line_record->>'savings_goal_id')::uuid,
        (line_record->>'asset_id')::uuid,
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
      )
      RETURNING id INTO new_template_line_id;

      INSERT INTO public.template_line_tag (template_line_id, tag_id)
      SELECT new_template_line_id, requested_tag.value::uuid
      FROM jsonb_array_elements_text(
        COALESCE(line_record->'tag_ids', '[]'::jsonb)
      ) AS requested_tag(value)
      ON CONFLICT DO NOTHING;
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
        'savings_goal_id', tl.savings_goal_id,
        'asset_id', tl.asset_id,
        'tag_ids', COALESCE(
          (SELECT json_agg(tlt.tag_id ORDER BY tlt.tag_id)
           FROM public.template_line_tag tlt
           WHERE tlt.template_line_id = tl.id),
          '[]'::json
        ),
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
$function$;

CREATE OR REPLACE FUNCTION public.update_budget_line_with_tags(p_budget_line_id uuid, p_patch jsonb, p_tag_ids uuid[])
 RETURNS public.budget_line
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  current_row public.budget_line%ROWTYPE;
  patched_row public.budget_line%ROWTYPE;
BEGIN
  SELECT source.*
  INTO current_row
  FROM public.budget_line AS source
  WHERE source.id = p_budget_line_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget line not found' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_patch, '{}'::jsonb) <> '{}'::jsonb THEN
    SELECT populated.*
    INTO patched_row
    FROM jsonb_populate_record(current_row, p_patch) AS populated;

    UPDATE public.budget_line AS target
    SET
      template_line_id = patched_row.template_line_id,
      savings_goal_id = patched_row.savings_goal_id,
      asset_id = patched_row.asset_id,
      name = patched_row.name,
      amount = patched_row.amount,
      original_amount = patched_row.original_amount,
      original_currency = patched_row.original_currency,
      target_currency = patched_row.target_currency,
      exchange_rate = patched_row.exchange_rate,
      kind = patched_row.kind,
      recurrence = patched_row.recurrence,
      is_manually_adjusted = patched_row.is_manually_adjusted,
      checked_at = patched_row.checked_at,
      updated_at = patched_row.updated_at
    WHERE target.id = p_budget_line_id
    RETURNING target.* INTO current_row;
  END IF;

  DELETE FROM public.budget_line_tag AS link
  WHERE link.budget_line_id = p_budget_line_id;

  INSERT INTO public.budget_line_tag (budget_line_id, tag_id)
  SELECT p_budget_line_id, tag_id
  FROM unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[])) AS tag_id;

  RETURN current_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_template_line_with_tags(p_template_line_id uuid, p_patch jsonb, p_tag_ids uuid[])
 RETURNS public.template_line
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  current_row public.template_line%ROWTYPE;
  patched_row public.template_line%ROWTYPE;
BEGIN
  SELECT source.*
  INTO current_row
  FROM public.template_line AS source
  WHERE source.id = p_template_line_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template line not found' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_patch, '{}'::jsonb) <> '{}'::jsonb THEN
    SELECT populated.*
    INTO patched_row
    FROM jsonb_populate_record(current_row, p_patch) AS populated;

    UPDATE public.template_line AS target
    SET
      savings_goal_id = patched_row.savings_goal_id,
      asset_id = patched_row.asset_id,
      name = patched_row.name,
      amount = patched_row.amount,
      original_amount = patched_row.original_amount,
      original_currency = patched_row.original_currency,
      target_currency = patched_row.target_currency,
      exchange_rate = patched_row.exchange_rate,
      kind = patched_row.kind,
      recurrence = patched_row.recurrence,
      description = patched_row.description,
      updated_at = patched_row.updated_at
    WHERE target.id = p_template_line_id
    RETURNING target.* INTO current_row;
  END IF;

  DELETE FROM public.template_line_tag AS link
  WHERE link.template_line_id = p_template_line_id;

  INSERT INTO public.template_line_tag (template_line_id, tag_id)
  SELECT p_template_line_id, tag_id
  FROM unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[])) AS tag_id;

  RETURN current_row;
END;
$function$;

