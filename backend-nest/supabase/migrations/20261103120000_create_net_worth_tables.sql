-- pulpe:migration-phase contract
-- pulpe:safe-after v0.59.0
-- Mon patrimoine: categories, assets and encrypted dated snapshots, plus the
-- rekey v3 that re-encrypts the snapshots.
--
-- Contract only because the API grants are revoked below and the composite
-- foreign keys are inline, which the expand checker refuses; nothing deployed
-- reads these tables yet.
--
-- A debt is an `asset` with direction = 'owe'. The latest snapshot is the
-- current value, so `asset_snapshot.value` is the only encrypted column.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.asset_category (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Target of the composite foreign key below: a row can only point at a
  -- category owned by the same user, with no trigger.
  CONSTRAINT asset_category_id_user_id_key UNIQUE (id, user_id)
);

-- Case-insensitive uniqueness per user; normalize(NFC) folds the composition
-- forms iOS emits (NFD), as for `tag`. Also serves the user_id lookups.
CREATE UNIQUE INDEX asset_category_user_id_name_lower_idx
  ON public.asset_category (user_id, lower(normalize(name, NFC)));

CREATE TABLE public.asset (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  currency text NOT NULL CHECK (currency IN ('CHF', 'EUR')),
  direction text NOT NULL CHECK (direction IN ('own', 'owe')),
  in_pulpe boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_id_user_id_key UNIQUE (id, user_id),
  -- RESTRICT: a category that still holds an asset cannot be deleted.
  CONSTRAINT asset_category_id_user_id_fkey
    FOREIGN KEY (category_id, user_id)
    REFERENCES public.asset_category (id, user_id) ON DELETE RESTRICT
);

CREATE INDEX asset_user_id_category_id_idx
  ON public.asset (user_id, category_id);

CREATE TABLE public.asset_snapshot (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL,
  -- AES-256-GCM ciphertext, encrypted through ENCRYPTION_PORT.
  value text NOT NULL CHECK (btrim(value) <> ''),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_snapshot_asset_id_user_id_fkey
    FOREIGN KEY (asset_id, user_id)
    REFERENCES public.asset (id, user_id) ON DELETE CASCADE
);

CREATE INDEX asset_snapshot_asset_id_recorded_at_idx
  ON public.asset_snapshot (asset_id, recorded_at DESC);
CREATE INDEX asset_snapshot_user_id_idx ON public.asset_snapshot (user_id);

-- ---------------------------------------------------------------------------
-- 2. updated_at triggers, RLS, grants
-- ---------------------------------------------------------------------------

CREATE OR REPLACE TRIGGER update_asset_category_updated_at
  BEFORE UPDATE ON public.asset_category
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_asset_updated_at
  BEFORE UPDATE ON public.asset
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.asset_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own asset categories" ON public.asset_category
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can create own asset categories" ON public.asset_category
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own asset categories" ON public.asset_category
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own asset categories" ON public.asset_category
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own assets" ON public.asset
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can create own assets" ON public.asset
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own assets" ON public.asset
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own assets" ON public.asset
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own asset snapshots" ON public.asset_snapshot
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can create own asset snapshots" ON public.asset_snapshot
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own asset snapshots" ON public.asset_snapshot
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own asset snapshots" ON public.asset_snapshot
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.asset_category, public.asset, public.asset_snapshot
  FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.asset_category, public.asset, public.asset_snapshot
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Rekey v3: v2 plus asset snapshots, and fail-closed v1 / v2
-- ---------------------------------------------------------------------------

-- Same security mode as v2: SECURITY DEFINER with an empty search_path, run by
-- service_role only. Locks are always taken plan withdrawals first, then asset
-- snapshots, in v1, v2 and v3, so the three entry points cannot deadlock.
CREATE OR REPLACE FUNCTION public.rekey_user_encrypted_data_with_asset_snapshots(
  p_user_id uuid,
  p_asset_snapshots jsonb DEFAULT '[]'::jsonb,
  p_plan_withdrawals jsonb DEFAULT '[]'::jsonb,
  p_budget_lines jsonb DEFAULT '[]'::jsonb,
  p_transactions jsonb DEFAULT '[]'::jsonb,
  p_template_lines jsonb DEFAULT '[]'::jsonb,
  p_savings_goals jsonb DEFAULT '[]'::jsonb,
  p_monthly_budgets jsonb DEFAULT '[]'::jsonb,
  p_key_check text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_expected_plans integer := jsonb_array_length(p_plan_withdrawals);
  v_expected_snapshots integer := jsonb_array_length(p_asset_snapshots);
  v_rows integer;
BEGIN
  LOCK TABLE public.savings_goal_plan_withdrawal
    IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.asset_snapshot IN SHARE ROW EXCLUSIVE MODE;

  -- The shared historical core deliberately receives no canary. key_check is
  -- written only after both newer tables have passed their exact-row
  -- assertions.
  PERFORM public.rekey_user_encrypted_data_core(
    p_user_id,
    p_budget_lines,
    p_transactions,
    p_template_lines,
    p_savings_goals,
    p_monthly_budgets,
    NULL
  );

  -- The backend read its payload before these locks existed, so a row
  -- committed in between would otherwise keep its old-DEK ciphertext while
  -- key_check moves on. Under the lock the count is authoritative, and
  -- key_check is still unwritten, so a stale payload fails the whole rekey.
  SELECT count(*) INTO v_rows
  FROM public.savings_goal_plan_withdrawal w
  WHERE w.user_id = p_user_id;
  IF v_rows <> v_expected_plans THEN
    RAISE EXCEPTION 'rekey: savings_goal_plan_withdrawal holds % rows, payload carries %',
      v_rows, v_expected_plans USING ERRCODE = 'P0001';
  END IF;

  IF v_expected_plans > 0 THEN
    UPDATE public.savings_goal_plan_withdrawal w
    SET amount = item.amount
    FROM jsonb_to_recordset(p_plan_withdrawals)
      AS item(id uuid, amount text)
    WHERE w.id = item.id AND w.user_id = p_user_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected_plans THEN
      RAISE EXCEPTION 'rekey: savings_goal_plan_withdrawal expected % rows, got %',
        v_expected_plans, v_rows USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT count(*) INTO v_rows
  FROM public.asset_snapshot s
  WHERE s.user_id = p_user_id;
  IF v_rows <> v_expected_snapshots THEN
    RAISE EXCEPTION 'rekey: asset_snapshot holds % rows, payload carries %',
      v_rows, v_expected_snapshots USING ERRCODE = 'P0001';
  END IF;

  IF v_expected_snapshots > 0 THEN
    UPDATE public.asset_snapshot s
    SET value = item.value
    FROM jsonb_to_recordset(p_asset_snapshots)
      AS item(id uuid, value text)
    WHERE s.id = item.id AND s.user_id = p_user_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected_snapshots THEN
      RAISE EXCEPTION 'rekey: asset_snapshot expected % rows, got %',
        v_expected_snapshots, v_rows USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_key_check IS NOT NULL THEN
    UPDATE public.user_encryption_key
    SET key_check = p_key_check, updated_at = now()
    WHERE user_id = p_user_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'rekey: key_check update expected 1 row, got %', v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
END;
$$;

ALTER FUNCTION public.rekey_user_encrypted_data_with_asset_snapshots(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rekey_user_encrypted_data_with_asset_snapshots(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rekey_user_encrypted_data_with_asset_snapshots(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) TO service_role;

-- v2: unchanged except that it now refuses, before any mutation, a user who
-- holds a snapshot it would leave under the old key. CREATE OR REPLACE keeps
-- the owner and the service_role-only grants of the existing function.
CREATE OR REPLACE FUNCTION public.rekey_user_encrypted_data_with_plan_withdrawals(
  p_user_id uuid,
  p_plan_withdrawals jsonb DEFAULT '[]'::jsonb,
  p_budget_lines jsonb DEFAULT '[]'::jsonb,
  p_transactions jsonb DEFAULT '[]'::jsonb,
  p_template_lines jsonb DEFAULT '[]'::jsonb,
  p_savings_goals jsonb DEFAULT '[]'::jsonb,
  p_monthly_budgets jsonb DEFAULT '[]'::jsonb,
  p_key_check text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_expected integer := jsonb_array_length(p_plan_withdrawals);
  v_rows integer;
BEGIN
  LOCK TABLE public.savings_goal_plan_withdrawal
    IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.asset_snapshot IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1
    FROM public.asset_snapshot s
    WHERE s.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'rekey: asset snapshot requires v3'
      USING ERRCODE = 'P0001';
  END IF;

  -- The shared historical core deliberately receives no canary. key_check is
  -- written only after the new table has also passed its exact-row assertion.
  PERFORM public.rekey_user_encrypted_data_core(
    p_user_id,
    p_budget_lines,
    p_transactions,
    p_template_lines,
    p_savings_goals,
    p_monthly_budgets,
    NULL
  );

  -- The backend read its payload before this lock existed, so a row committed
  -- in between would otherwise keep its old-DEK ciphertext while key_check
  -- moves on. Under the lock this count is authoritative, and key_check is
  -- still unwritten, so a stale payload fails the whole rekey instead.
  SELECT count(*) INTO v_rows
  FROM public.savings_goal_plan_withdrawal w
  WHERE w.user_id = p_user_id;
  IF v_rows <> v_expected THEN
    RAISE EXCEPTION 'rekey: savings_goal_plan_withdrawal holds % rows, payload carries %',
      v_rows, v_expected USING ERRCODE = 'P0001';
  END IF;

  IF v_expected > 0 THEN
    UPDATE public.savings_goal_plan_withdrawal w
    SET amount = item.amount
    FROM jsonb_to_recordset(p_plan_withdrawals)
      AS item(id uuid, amount text)
    WHERE w.id = item.id AND w.user_id = p_user_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected THEN
      RAISE EXCEPTION 'rekey: savings_goal_plan_withdrawal expected % rows, got %',
        v_expected, v_rows USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_key_check IS NOT NULL THEN
    UPDATE public.user_encryption_key
    SET key_check = p_key_check, updated_at = now()
    WHERE user_id = p_user_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'rekey: key_check update expected 1 row, got %', v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
END;
$$;

-- v1: same, ahead of the plan withdrawal check.
CREATE OR REPLACE FUNCTION public.rekey_user_encrypted_data(
  p_user_id uuid,
  p_budget_lines jsonb DEFAULT '[]'::jsonb,
  p_transactions jsonb DEFAULT '[]'::jsonb,
  p_template_lines jsonb DEFAULT '[]'::jsonb,
  p_savings_goals jsonb DEFAULT '[]'::jsonb,
  p_monthly_budgets jsonb DEFAULT '[]'::jsonb,
  p_key_check text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Prevent a plan or snapshot row from appearing between the fail-closed
  -- check and the core/key_check update. Rekeys are rare; a short table lock
  -- is safer than a per-session flag that another deployment could bypass.
  LOCK TABLE public.savings_goal_plan_withdrawal
    IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.asset_snapshot IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1
    FROM public.asset_snapshot s
    WHERE s.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'rekey: asset snapshot requires v3'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.savings_goal_plan_withdrawal w
    WHERE w.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'rekey: plan withdrawal requires v2'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.rekey_user_encrypted_data_core(
    p_user_id,
    p_budget_lines,
    p_transactions,
    p_template_lines,
    p_savings_goals,
    p_monthly_budgets,
    p_key_check
  );
END;
$$;
