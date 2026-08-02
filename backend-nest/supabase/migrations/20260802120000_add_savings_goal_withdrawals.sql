-- PUL-329 — use a savings goal as the source of an income (a withdrawal).
--
-- A withdrawal is an ordinary free income transaction that names the goal it
-- came from. Amounts stay AES-256-GCM ciphertexts, so PostgreSQL can never
-- recompute the goal balance itself: it only guarantees that the balance the
-- backend decrypted and checked is still the contemporary one, through
-- savings_goal.balance_revision compared under lock.

-- ---------------------------------------------------------------------------
-- 1. A durable source link on transaction
-- ---------------------------------------------------------------------------

ALTER TABLE public.transaction
  ADD COLUMN source_savings_goal_id uuid
    REFERENCES public.savings_goal(id) ON DELETE SET NULL,
  ADD COLUMN source_savings_goal_name text;

-- Three explicit states: both null (ordinary transaction), both set (active
-- link), id null with the name kept (goal deleted, history stays readable).
ALTER TABLE public.transaction
  ADD CONSTRAINT transaction_source_savings_goal_snapshot CHECK (
    source_savings_goal_id IS NULL OR source_savings_goal_name IS NOT NULL
  ),
  ADD CONSTRAINT transaction_source_savings_goal_name_not_blank CHECK (
    source_savings_goal_name IS NULL
    OR btrim(source_savings_goal_name) <> ''
  ),
  ADD CONSTRAINT transaction_source_savings_goal_free_income CHECK (
    source_savings_goal_name IS NULL
    OR (
      kind = 'income'::public.transaction_kind
      AND budget_line_id IS NULL
    )
  );

-- Chronological history of a goal's withdrawals.
CREATE INDEX transaction_source_savings_goal_idx
  ON public.transaction (source_savings_goal_id, transaction_date DESC, id)
  WHERE source_savings_goal_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. A revision that any balance-affecting change invalidates
-- ---------------------------------------------------------------------------

ALTER TABLE public.savings_goal
  ADD COLUMN balance_revision bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_savings_goal_balance_revision(
  p_goal_ids uuid[]
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  UPDATE public.savings_goal
  SET balance_revision = balance_revision + 1
  WHERE id = ANY(
    SELECT DISTINCT goal_id
    FROM unnest(p_goal_ids) AS goal_id
    WHERE goal_id IS NOT NULL
  );
$$;

-- Changing the starting stock changes the balance itself.
CREATE OR REPLACE FUNCTION public.bump_own_savings_goal_balance_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.initial_amount IS DISTINCT FROM OLD.initial_amount THEN
    NEW.balance_revision := OLD.balance_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;

-- A linked forecast carries confirmed contributions; any change to it may
-- change the confirmed stock or its chronology. Invalidating conservatively
-- can cost a retry, never a wrong balance.
CREATE OR REPLACE FUNCTION public.bump_savings_goal_revision_from_budget_line()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_goal_ids uuid[] := '{}'::uuid[];
BEGIN
  -- The trigger sits on one of the most written tables of the app and almost
  -- no row reaches a goal. In a row-level trigger the absent record reads as
  -- NULL, so this one test covers insert, update and delete alike.
  IF OLD.savings_goal_id IS NULL AND NEW.savings_goal_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    v_goal_ids := v_goal_ids || OLD.savings_goal_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_goal_ids := v_goal_ids || NEW.savings_goal_id;
  END IF;

  PERFORM public.bump_savings_goal_balance_revision(v_goal_ids);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Two independent reasons for a transaction to touch a goal: it is allocated
-- to one of its forecasts (a contribution), or it declares it as its source
-- (a withdrawal). Moving a withdrawal to another date or budget keeps the
-- total but moves it in the timeline, so it invalidates too.
CREATE OR REPLACE FUNCTION public.bump_savings_goal_revision_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_goal_ids uuid[] := '{}'::uuid[];
BEGIN
  -- Same reasoning as the forecast trigger, and it matters more here: without
  -- this test every ordinary transaction write would read a forecast row and
  -- then take the goal row, in the opposite lock order from the goal RPCs.
  IF OLD.source_savings_goal_id IS NULL
    AND NEW.source_savings_goal_id IS NULL
    AND OLD.budget_line_id IS NULL
    AND NEW.budget_line_id IS NULL
  THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    v_goal_ids := v_goal_ids || OLD.source_savings_goal_id || (
      SELECT bl.savings_goal_id
      FROM public.budget_line bl
      WHERE bl.id = OLD.budget_line_id
    );
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_goal_ids := v_goal_ids || NEW.source_savings_goal_id || (
      SELECT bl.savings_goal_id
      FROM public.budget_line bl
      WHERE bl.id = NEW.budget_line_id
    );
  END IF;

  PERFORM public.bump_savings_goal_balance_revision(v_goal_ids);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- While the link is active the snapshot IS the current name, so a deleted
-- goal simply leaves the last known name behind with a null identifier.
CREATE OR REPLACE FUNCTION public.sync_savings_goal_withdrawal_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.transaction
    SET source_savings_goal_name = NEW.name
    WHERE source_savings_goal_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.bump_savings_goal_balance_revision(uuid[]) OWNER TO postgres;
ALTER FUNCTION public.bump_own_savings_goal_balance_revision() OWNER TO postgres;
ALTER FUNCTION public.bump_savings_goal_revision_from_budget_line() OWNER TO postgres;
ALTER FUNCTION public.bump_savings_goal_revision_from_transaction() OWNER TO postgres;
ALTER FUNCTION public.sync_savings_goal_withdrawal_name() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.bump_savings_goal_balance_revision(uuid[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_own_savings_goal_balance_revision()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_savings_goal_revision_from_budget_line()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_savings_goal_revision_from_transaction()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_savings_goal_withdrawal_name()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER bump_own_savings_goal_balance_revision
  BEFORE UPDATE OF initial_amount ON public.savings_goal
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_own_savings_goal_balance_revision();

CREATE TRIGGER sync_savings_goal_withdrawal_name
  AFTER UPDATE OF name ON public.savings_goal
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_savings_goal_withdrawal_name();

CREATE TRIGGER bump_savings_goal_revision_from_budget_line
  AFTER INSERT OR UPDATE OR DELETE ON public.budget_line
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_savings_goal_revision_from_budget_line();

CREATE TRIGGER bump_savings_goal_revision_from_transaction
  AFTER INSERT OR UPDATE OR DELETE ON public.transaction
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_savings_goal_revision_from_transaction();

-- ---------------------------------------------------------------------------
-- 3. All-or-nothing withdrawal writes
-- ---------------------------------------------------------------------------

-- Shared by the three RPCs below so two withdrawal writes on the same goal
-- serialize; the savings_goal row lock they take next serializes them against
-- the goal's own RPCs (plan apply, target reconciliation, deletion).
CREATE OR REPLACE FUNCTION public.lock_savings_goal_for_withdrawal(
  p_goal_id uuid,
  p_expected_revision bigint
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_name text;
  v_revision bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('savings_goal_withdrawal'),
    hashtext(p_goal_id::text)
  );

  SELECT sg.name, sg.balance_revision
  INTO v_name, v_revision
  FROM public.savings_goal sg
  WHERE sg.id = p_goal_id AND sg.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  IF v_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'Savings goal balance changed' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_savings_goal_withdrawal_tags(
  p_tag_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_tag_ids IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_tag_ids) AS requested(tag_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tag t
      WHERE t.id = requested.tag_id AND t.user_id = (SELECT auth.uid())
    )
  ) THEN
    RAISE EXCEPTION 'Tag access denied' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_savings_goal_withdrawal(
  p_goal_id uuid,
  p_expected_revision bigint,
  p_transaction jsonb,
  p_tag_ids uuid[] DEFAULT NULL
) RETURNS public.transaction
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_goal_name text;
  v_input public.transaction%ROWTYPE;
  v_row public.transaction%ROWTYPE;
BEGIN
  v_goal_name := public.lock_savings_goal_for_withdrawal(
    p_goal_id,
    p_expected_revision
  );

  SELECT populated.*
  INTO v_input
  FROM jsonb_populate_record(NULL::public.transaction, p_transaction) AS populated;

  IF v_input.kind IS DISTINCT FROM 'income'::public.transaction_kind THEN
    RAISE EXCEPTION 'Savings goal withdrawal must be an income'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_input.budget_line_id IS NOT NULL THEN
    RAISE EXCEPTION 'Savings goal withdrawal must stay unallocated'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.monthly_budget mb
  WHERE mb.id = v_input.budget_id AND mb.user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget access denied' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_savings_goal_withdrawal_tags(p_tag_ids);

  INSERT INTO public.transaction (
    id,
    budget_id,
    name,
    amount,
    original_amount,
    original_currency,
    target_currency,
    exchange_rate,
    kind,
    transaction_date,
    checked_at,
    source_savings_goal_id,
    source_savings_goal_name
  ) VALUES (
    COALESCE(v_input.id, gen_random_uuid()),
    v_input.budget_id,
    v_input.name,
    v_input.amount,
    v_input.original_amount,
    v_input.original_currency,
    v_input.target_currency,
    v_input.exchange_rate,
    v_input.kind,
    COALESCE(v_input.transaction_date, now()),
    v_input.checked_at,
    p_goal_id,
    v_goal_name
  )
  RETURNING * INTO v_row;

  INSERT INTO public.transaction_tag (transaction_id, tag_id)
  SELECT v_row.id, tag_id
  FROM unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[])) AS tag_id;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_savings_goal_withdrawal(
  p_transaction_id uuid,
  p_expected_revision bigint,
  p_patch jsonb,
  p_tag_ids uuid[] DEFAULT NULL
) RETURNS public.transaction
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_goal_id uuid;
  v_goal_name text;
  v_current public.transaction%ROWTYPE;
  v_patched public.transaction%ROWTYPE;
  v_row public.transaction%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT tx.source_savings_goal_id
  INTO v_goal_id
  FROM public.transaction tx
  JOIN public.monthly_budget mb ON mb.id = tx.budget_id
  WHERE tx.id = p_transaction_id AND mb.user_id = v_uid;

  IF v_goal_id IS NULL THEN
    RAISE EXCEPTION 'Savings goal withdrawal not found' USING ERRCODE = 'P0001';
  END IF;

  -- Goal lock first, transaction row lock second: same order as every other
  -- savings-goal RPC, so concurrent writers queue instead of deadlocking.
  v_goal_name := public.lock_savings_goal_for_withdrawal(
    v_goal_id,
    p_expected_revision
  );

  SELECT source.*
  INTO v_current
  FROM public.transaction AS source
  WHERE source.id = p_transaction_id
  FOR UPDATE;

  IF v_current.source_savings_goal_id IS DISTINCT FROM v_goal_id THEN
    RAISE EXCEPTION 'Savings goal withdrawal source changed'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_savings_goal_withdrawal_tags(p_tag_ids);

  SELECT populated.*
  INTO v_patched
  FROM jsonb_populate_record(v_current, COALESCE(p_patch, '{}'::jsonb)) AS populated;

  IF v_patched.kind IS DISTINCT FROM 'income'::public.transaction_kind THEN
    RAISE EXCEPTION 'Savings goal withdrawal must be an income'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_patched.budget_line_id IS NOT NULL THEN
    RAISE EXCEPTION 'Savings goal withdrawal must stay unallocated'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_patched.budget_id IS DISTINCT FROM v_current.budget_id THEN
    PERFORM 1
    FROM public.monthly_budget mb
    WHERE mb.id = v_patched.budget_id AND mb.user_id = v_uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Budget access denied' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.transaction AS target
  SET
    budget_id = v_patched.budget_id,
    name = v_patched.name,
    amount = v_patched.amount,
    original_amount = v_patched.original_amount,
    original_currency = v_patched.original_currency,
    target_currency = v_patched.target_currency,
    exchange_rate = v_patched.exchange_rate,
    transaction_date = v_patched.transaction_date,
    checked_at = v_patched.checked_at,
    source_savings_goal_name = v_goal_name,
    updated_at = now()
  WHERE target.id = p_transaction_id
  RETURNING target.* INTO v_row;

  IF p_tag_ids IS NOT NULL THEN
    DELETE FROM public.transaction_tag AS link
    WHERE link.transaction_id = p_transaction_id;

    INSERT INTO public.transaction_tag (transaction_id, tag_id)
    SELECT p_transaction_id, tag_id
    FROM unnest(p_tag_ids) AS tag_id;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_savings_goal_withdrawal(
  p_transaction_id uuid,
  p_expected_revision bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_goal_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT tx.source_savings_goal_id
  INTO v_goal_id
  FROM public.transaction tx
  JOIN public.monthly_budget mb ON mb.id = tx.budget_id
  WHERE tx.id = p_transaction_id AND mb.user_id = v_uid;

  IF v_goal_id IS NULL THEN
    RAISE EXCEPTION 'Savings goal withdrawal not found' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.lock_savings_goal_for_withdrawal(
    v_goal_id,
    p_expected_revision
  );

  PERFORM 1
  FROM public.transaction tx
  WHERE tx.id = p_transaction_id
  FOR UPDATE;

  DELETE FROM public.transaction_tag AS link
  WHERE link.transaction_id = p_transaction_id;

  DELETE FROM public.transaction AS tx
  WHERE tx.id = p_transaction_id;
END;
$$;

ALTER FUNCTION public.lock_savings_goal_for_withdrawal(uuid, bigint)
  OWNER TO postgres;
ALTER FUNCTION public.assert_savings_goal_withdrawal_tags(uuid[])
  OWNER TO postgres;
ALTER FUNCTION public.create_savings_goal_withdrawal(uuid, bigint, jsonb, uuid[])
  OWNER TO postgres;
ALTER FUNCTION public.update_savings_goal_withdrawal(uuid, bigint, jsonb, uuid[])
  OWNER TO postgres;
ALTER FUNCTION public.delete_savings_goal_withdrawal(uuid, bigint)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.lock_savings_goal_for_withdrawal(uuid, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_savings_goal_withdrawal_tags(uuid[])
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.create_savings_goal_withdrawal(uuid, bigint, jsonb, uuid[])
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION
  public.update_savings_goal_withdrawal(uuid, bigint, jsonb, uuid[])
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION
  public.delete_savings_goal_withdrawal(uuid, bigint)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.create_savings_goal_withdrawal(uuid, bigint, jsonb, uuid[])
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.update_savings_goal_withdrawal(uuid, bigint, jsonb, uuid[])
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.delete_savings_goal_withdrawal(uuid, bigint)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Deletion preview: withdrawals are shown, never deleted
-- ---------------------------------------------------------------------------
--
-- apply_savings_goal_deletion needs no change: every set it deletes is reached
-- through budget_line.savings_goal_id, and a withdrawal is by construction
-- unallocated. The FK above turns its identifier to null while the snapshot
-- name — kept current by sync_savings_goal_withdrawal_name — survives.

CREATE OR REPLACE FUNCTION public.get_savings_goal_deletion_impact(
  p_goal_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.savings_goal
    WHERE id = p_goal_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'goalId', p_goal_id,
    'templateLines', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'lineId', tl.id,
          'templateId', t.id,
          'templateName', t.name,
          'name', tl.name,
          'amount', tl.amount,
          'recurrence', tl.recurrence,
          'updatedAt', tl.updated_at
        )
        ORDER BY t.name, tl.name, tl.id
      )
      FROM public.template_line tl
      JOIN public.template t ON t.id = tl.template_id
      WHERE tl.savings_goal_id = p_goal_id
        AND t.user_id = v_uid
    ), '[]'::jsonb),
    'budgets', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'budgetId', grouped_budget.budget_id,
          'month', grouped_budget.month,
          'year', grouped_budget.year,
          'lines', grouped_budget.lines
        )
        ORDER BY grouped_budget.year, grouped_budget.month, grouped_budget.budget_id
      )
      FROM (
        SELECT
          mb.id AS budget_id,
          mb.month,
          mb.year,
          jsonb_agg(
            jsonb_build_object(
              'lineId', bl.id,
              'name', bl.name,
              'amount', bl.amount,
              'recurrence', bl.recurrence,
              'checkedAt', bl.checked_at,
              'updatedAt', bl.updated_at,
              'transactions', COALESCE((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', tx.id,
                    'budgetId', tx.budget_id,
                    'budgetLineId', tx.budget_line_id,
                    'name', tx.name,
                    'amount', tx.amount,
                    'kind', tx.kind,
                    'transactionDate', tx.transaction_date,
                    'checkedAt', tx.checked_at,
                    'createdAt', tx.created_at,
                    'updatedAt', tx.updated_at,
                    'originalAmount', tx.original_amount,
                    'originalCurrency', tx.original_currency,
                    'targetCurrency', tx.target_currency,
                    'exchangeRate', tx.exchange_rate
                  )
                  ORDER BY tx.transaction_date DESC, tx.id
                )
                FROM public.transaction tx
                WHERE tx.budget_line_id = bl.id
              ), '[]'::jsonb)
            )
            ORDER BY bl.name, bl.id
          ) AS lines
        FROM public.budget_line bl
        JOIN public.monthly_budget mb ON mb.id = bl.budget_id
        WHERE bl.savings_goal_id = p_goal_id
          AND mb.user_id = v_uid
        GROUP BY mb.id, mb.month, mb.year
      ) grouped_budget
    ), '[]'::jsonb),
    -- Incomes sourced from the goal. Preserved by every deletion mode, so they
    -- are reported apart from the deletable sets and stay out of the revision.
    'withdrawals', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'transactionId', tx.id,
          'budgetId', tx.budget_id,
          'name', tx.name,
          'transactionDate', tx.transaction_date,
          'amount', tx.amount
        )
        ORDER BY tx.transaction_date DESC, tx.id
      )
      FROM public.transaction tx
      JOIN public.monthly_budget mb ON mb.id = tx.budget_id
      WHERE tx.source_savings_goal_id = p_goal_id
        AND mb.user_id = v_uid
    ), '[]'::jsonb),
    'revision', jsonb_build_object(
      'templateLines', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', tl.id, 'updatedAt', tl.updated_at)
          ORDER BY tl.id
        )
        FROM public.template_line tl
        JOIN public.template t ON t.id = tl.template_id
        WHERE tl.savings_goal_id = p_goal_id
          AND t.user_id = v_uid
      ), '[]'::jsonb),
      'budgetLines', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', bl.id, 'updatedAt', bl.updated_at)
          ORDER BY bl.id
        )
        FROM public.budget_line bl
        JOIN public.monthly_budget mb ON mb.id = bl.budget_id
        WHERE bl.savings_goal_id = p_goal_id
          AND mb.user_id = v_uid
      ), '[]'::jsonb),
      'transactions', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', tx.id, 'updatedAt', tx.updated_at)
          ORDER BY tx.id
        )
        FROM public.transaction tx
        JOIN public.budget_line bl ON bl.id = tx.budget_line_id
        JOIN public.monthly_budget mb ON mb.id = bl.budget_id
        WHERE bl.savings_goal_id = p_goal_id
          AND mb.user_id = v_uid
      ), '[]'::jsonb)
    )
  );
END;
$$;

ALTER FUNCTION public.get_savings_goal_deletion_impact(uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.get_savings_goal_deletion_impact(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_savings_goal_deletion_impact(uuid)
  TO authenticated, service_role;
