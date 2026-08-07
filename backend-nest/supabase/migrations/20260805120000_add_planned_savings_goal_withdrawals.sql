-- Plan a withdrawal before making it: a forecast income that names the savings
-- goal it will be drawn from, and the allocated transaction that realizes it.
--
-- PUL-329 gave a REAL income the right to name its source. What was missing is
-- the announcement: a budget_line that says "500 will come out of this goal",
-- which lowers the projection without touching the confirmed stock. The stock
-- only moves when the real income lands, and it lands allocated to that
-- forecast so prévu and réel stay reconciled instead of double-counted.
--
-- Amounts remain AES-256-GCM ciphertexts, so PostgreSQL still cannot recompute
-- a balance. Everything here is shape, tenancy and serialization; the balance
-- arithmetic stays in the backend, certified by savings_goal.balance_revision.

-- ---------------------------------------------------------------------------
-- 1. The source link on budget_line
-- ---------------------------------------------------------------------------

ALTER TABLE public.budget_line
  ADD COLUMN source_savings_goal_id uuid
    REFERENCES public.savings_goal(id) ON DELETE SET NULL,
  ADD COLUMN source_savings_goal_name text;

-- Same three states as transaction (20260802120000): both null (ordinary
-- forecast), both set (active link), id null with the name kept (goal deleted,
-- the provenance stays readable and the line stops being realizable).
ALTER TABLE public.budget_line
  ADD CONSTRAINT budget_line_source_savings_goal_snapshot CHECK (
    source_savings_goal_id IS NULL OR source_savings_goal_name IS NOT NULL
  ),
  ADD CONSTRAINT budget_line_source_savings_goal_name_not_blank CHECK (
    source_savings_goal_name IS NULL
    OR btrim(source_savings_goal_name) <> ''
  ),
  -- A withdrawal is a one-off income, and it can never also be a contribution:
  -- savings_goal_id fills the pot, source_savings_goal_id empties it. Holding
  -- both would make every balance query ask which way the money went.
  ADD CONSTRAINT budget_line_source_savings_goal_one_off_income CHECK (
    source_savings_goal_name IS NULL
    OR (
      kind = 'income'::public.transaction_kind
      AND recurrence = 'one_off'::public.transaction_recurrence
      AND savings_goal_id IS NULL
    )
  );

-- Read path: every forecast drawing on one goal, for the progress projection.
CREATE INDEX budget_line_source_savings_goal_idx
  ON public.budget_line (source_savings_goal_id)
  WHERE source_savings_goal_id IS NOT NULL;

-- Same tenancy hole as the one closed on transaction: RLS proves the BUDGET is
-- the caller's and the FK proves the goal exists, but neither proves the two
-- hang off the same user. Without this, a forged link would pull another
-- user's goal name into this row and bump their balance_revision. BEFORE, so
-- raising aborts the statement before any AFTER trigger runs.
--
-- It also WRITES the snapshot name. The row it has to read for tenancy is the
-- same row that holds the name, so asking the backend to fetch it again would
-- add a round-trip and a window in which the two could disagree. This is the
-- budget_line counterpart of create_savings_goal_withdrawal, which likewise
-- stamps the name it read under lock rather than trusting a client.
CREATE OR REPLACE FUNCTION public.enforce_budget_line_savings_goal_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_owner_id uuid;
  v_goal_name text;
BEGIN
  -- Covers the ON DELETE SET NULL write too: unlinking is always free, and the
  -- name it leaves behind is exactly what keeps the provenance readable.
  IF NEW.source_savings_goal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT mb.user_id
  INTO v_owner_id
  FROM public.monthly_budget mb
  WHERE mb.id = NEW.budget_id;

  SELECT sg.name
  INTO v_goal_name
  FROM public.savings_goal sg
  WHERE sg.id = NEW.source_savings_goal_id
    AND sg.user_id = v_owner_id;

  IF v_owner_id IS NULL OR v_goal_name IS NULL THEN
    RAISE EXCEPTION 'Savings goal access denied'
      USING ERRCODE = 'P0001';
  END IF;

  NEW.source_savings_goal_name := v_goal_name;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_budget_line_savings_goal_source() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_budget_line_savings_goal_source()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_budget_line_savings_goal_source
  ON public.budget_line;
CREATE TRIGGER enforce_budget_line_savings_goal_source
  BEFORE INSERT OR UPDATE OF source_savings_goal_id, budget_id
  ON public.budget_line
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_budget_line_savings_goal_source();

-- ---------------------------------------------------------------------------
-- 2. The forecast joins the two mechanisms it already had
-- ---------------------------------------------------------------------------

-- Renaming a goal must reach its planned withdrawals too, or the budget would
-- keep showing "Pris sur · <old name>" until the line is realized.
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

    UPDATE public.budget_line
    SET source_savings_goal_name = NEW.name
    WHERE source_savings_goal_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- A planned withdrawal moves the PROJECTION, not the confirmed stock — but the
-- revision guards every balance the backend decrypted, projection included,
-- and the picker preview reads one. Invalidating conservatively costs a retry;
-- not invalidating would let a preview certify a plan that has since changed.
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
  IF OLD.savings_goal_id IS NULL AND NEW.savings_goal_id IS NULL
    AND OLD.source_savings_goal_id IS NULL
    AND NEW.source_savings_goal_id IS NULL
  THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    v_goal_ids := v_goal_ids || OLD.savings_goal_id || OLD.source_savings_goal_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_goal_ids := v_goal_ids || NEW.savings_goal_id || NEW.source_savings_goal_id;
  END IF;

  PERFORM public.bump_savings_goal_balance_revision(v_goal_ids);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. A real withdrawal may now realize its own forecast
-- ---------------------------------------------------------------------------

-- The old CHECK read "a withdrawal must stay unallocated". Its reason was that
-- allocating one to a forecast would double-count it against the goal's own
-- CONTRIBUTIONS — true of a contribution forecast (savings_goal_id, saving),
-- which is what existed when it was written. A planned-withdrawal forecast is
-- the opposite movement, and allocating to it is precisely what keeps prévu
-- and réel from being counted twice. The shape rule therefore moves into the
-- trigger below, which can read the referenced line; a CHECK cannot.
ALTER TABLE public.transaction
  DROP CONSTRAINT transaction_source_savings_goal_free_income;

ALTER TABLE public.transaction
  ADD CONSTRAINT transaction_source_savings_goal_income CHECK (
    source_savings_goal_name IS NULL
    OR kind = 'income'::public.transaction_kind
  );

CREATE OR REPLACE FUNCTION public.enforce_transaction_savings_goal_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_owner_id uuid;
  v_line_source_goal_id uuid;
  v_line_kind public.transaction_kind;
  v_line_found boolean;
BEGIN
  -- Covers the ON DELETE SET NULL write too: unlinking is always free.
  IF NEW.source_savings_goal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT mb.user_id
  INTO v_owner_id
  FROM public.monthly_budget mb
  WHERE mb.id = NEW.budget_id;

  IF v_owner_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.savings_goal sg
    WHERE sg.id = NEW.source_savings_goal_id
      AND sg.user_id = v_owner_id
  ) THEN
    RAISE EXCEPTION 'Savings goal access denied'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.budget_line_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allocated: the line must be the plan for THIS withdrawal. Anything else —
  -- an expense envelope, a contribution forecast, a plan on another goal —
  -- would attribute the movement to a forecast that never announced it.
  -- Same-budget coherence is already carried by enforce_transaction_budget_line_link.
  SELECT true, bl.source_savings_goal_id, bl.kind
  INTO v_line_found, v_line_source_goal_id, v_line_kind
  FROM public.budget_line bl
  WHERE bl.id = NEW.budget_line_id;

  IF NOT COALESCE(v_line_found, false)
    OR v_line_kind IS DISTINCT FROM 'income'::public.transaction_kind
    OR v_line_source_goal_id IS DISTINCT FROM NEW.source_savings_goal_id
  THEN
    RAISE EXCEPTION 'Savings goal withdrawal must realize its own forecast'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- budget_line_id joins the watched columns: without it, setting an allocation
-- on an already-sourced transaction would slip past the rule above.
DROP TRIGGER IF EXISTS enforce_transaction_savings_goal_source
  ON public.transaction;
CREATE TRIGGER enforce_transaction_savings_goal_source
  BEFORE INSERT OR UPDATE OF source_savings_goal_id, budget_id, budget_line_id
  ON public.transaction
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_transaction_savings_goal_source();

-- ---------------------------------------------------------------------------
-- 4. One write path, now able to carry an allocation
-- ---------------------------------------------------------------------------

-- Deliberately the SAME RPC as the free withdrawal rather than a second one:
-- both debit the goal, both need the advisory lock, the row lock and the
-- revision check. Only the allocation differs, and the trigger above is what
-- validates it — this function just stops refusing it outright.
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
    budget_line_id,
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
    v_input.budget_line_id,
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

-- Its sibling refused the same thing on the way out: a realized planned
-- withdrawal IS allocated for the rest of its life, so "must stay unallocated"
-- would lock the user out of correcting the amount they just entered. What
-- must still be refused is MOVING the allocation — the UPDATE below never
-- writes budget_line_id, so a patch claiming to change it would be silently
-- dropped, and the caller would believe a move happened that never did.
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

  IF v_patched.budget_line_id IS DISTINCT FROM v_current.budget_line_id THEN
    RAISE EXCEPTION 'Savings goal withdrawal allocation is immutable'
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

ALTER FUNCTION public.create_savings_goal_withdrawal(uuid, bigint, jsonb, uuid[])
  OWNER TO postgres;
ALTER FUNCTION public.update_savings_goal_withdrawal(uuid, bigint, jsonb, uuid[])
  OWNER TO postgres;
ALTER FUNCTION public.sync_savings_goal_withdrawal_name() OWNER TO postgres;
ALTER FUNCTION public.bump_savings_goal_revision_from_budget_line() OWNER TO postgres;
ALTER FUNCTION public.enforce_transaction_savings_goal_source() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.sync_savings_goal_withdrawal_name()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_savings_goal_revision_from_budget_line()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_transaction_savings_goal_source()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.create_savings_goal_withdrawal(uuid, bigint, jsonb, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.create_savings_goal_withdrawal(uuid, bigint, jsonb, uuid[])
  TO authenticated, service_role;
