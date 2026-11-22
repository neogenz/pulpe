-- pulpe:migration-phase contract
-- pulpe:safe-after v0.65.0
-- « Comparer avec mes comptes »: one row per person holding the encrypted
-- starting amount and the time of the last completed comparison, plus the
-- rekey v4 that re-encrypts that amount.
--
-- Contract because the API grants are revoked below and the foreign key is
-- inline, which the expand checker refuses. v0.65.0 never writes this table
-- and calls v3, which keeps working for everyone until a starting amount
-- exists.

-- ---------------------------------------------------------------------------
-- 1. Table, updated_at trigger, RLS, grants
-- ---------------------------------------------------------------------------

CREATE TABLE public.user_reconciliation (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- AES-256-GCM ciphertext, encrypted through ENCRYPTION_PORT; NULL reads as
  -- 0. An empty string would look like no amount to the rekey and block every
  -- PIN change, hence the check.
  starting_amount text CHECK (btrim(starting_amount) <> ''),
  last_completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_user_reconciliation_updated_at
  BEFORE UPDATE ON public.user_reconciliation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reconciliation"
  ON public.user_reconciliation
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own reconciliation"
  ON public.user_reconciliation
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own reconciliation"
  ON public.user_reconciliation
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.user_reconciliation FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_reconciliation TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Rekey v4: v3 plus the starting amount, and fail-closed v1 to v3
-- ---------------------------------------------------------------------------

-- Same security mode as v3: SECURITY DEFINER with an empty search_path, run by
-- service_role only. Locks are always taken plan withdrawals, then asset
-- snapshots, then user_reconciliation, in v1 to v4, so the four entry points
-- cannot deadlock.
CREATE OR REPLACE FUNCTION public.rekey_user_encrypted_data_with_starting_amount(
  p_user_id uuid,
  p_starting_amount text DEFAULT NULL,
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
  v_expected_amounts integer := (p_starting_amount IS NOT NULL)::integer;
  v_rows integer;
BEGIN
  LOCK TABLE public.savings_goal_plan_withdrawal
    IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.asset_snapshot IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.user_reconciliation IN SHARE ROW EXCLUSIVE MODE;

  -- The shared historical core deliberately receives no canary. key_check is
  -- written only after the three newer tables have passed their assertions.
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

  -- One row per person, keyed by p_user_id: the payload carries its starting
  -- amount or NULL, and the count under the lock catches a stale read.
  SELECT count(*) INTO v_rows
  FROM public.user_reconciliation r
  WHERE r.user_id = p_user_id AND r.starting_amount IS NOT NULL;
  IF v_rows <> v_expected_amounts THEN
    RAISE EXCEPTION 'rekey: user_reconciliation holds % starting amounts, payload carries %',
      v_rows, v_expected_amounts USING ERRCODE = 'P0001';
  END IF;

  IF v_expected_amounts > 0 THEN
    UPDATE public.user_reconciliation r
    SET starting_amount = p_starting_amount
    WHERE r.user_id = p_user_id;
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

ALTER FUNCTION public.rekey_user_encrypted_data_with_starting_amount(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rekey_user_encrypted_data_with_starting_amount(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rekey_user_encrypted_data_with_starting_amount(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) TO service_role;

-- v1 to v3 only serve a pod still running during a rolling deploy. Each keeps
-- its signature, owner and service_role-only grant (CREATE OR REPLACE), checks
-- under the locks that the person holds nothing it would leave under the old
-- key, then hands its payload to v4 with empty arrays for the tables it never
-- read. Under those checks v4 behaves exactly as the old body did, and a
-- future v5 only has to re-create v4 for the three of them to refuse too.

-- v3: refuses a starting amount.
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
BEGIN
  LOCK TABLE public.savings_goal_plan_withdrawal
    IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.asset_snapshot IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.user_reconciliation IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1
    FROM public.user_reconciliation r
    WHERE r.user_id = p_user_id AND r.starting_amount IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'rekey: starting amount requires v4'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.rekey_user_encrypted_data_with_starting_amount(
    p_user_id,
    NULL,
    p_asset_snapshots,
    p_plan_withdrawals,
    p_budget_lines,
    p_transactions,
    p_template_lines,
    p_savings_goals,
    p_monthly_budgets,
    p_key_check
  );
END;
$$;

-- v2: same, ahead of the asset snapshot check.
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
BEGIN
  LOCK TABLE public.savings_goal_plan_withdrawal
    IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.asset_snapshot IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.user_reconciliation IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1
    FROM public.user_reconciliation r
    WHERE r.user_id = p_user_id AND r.starting_amount IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'rekey: starting amount requires v4'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.asset_snapshot s
    WHERE s.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'rekey: asset snapshot requires v3'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.rekey_user_encrypted_data_with_starting_amount(
    p_user_id,
    NULL,
    '[]'::jsonb,
    p_plan_withdrawals,
    p_budget_lines,
    p_transactions,
    p_template_lines,
    p_savings_goals,
    p_monthly_budgets,
    p_key_check
  );
END;
$$;

-- v1: same, ahead of the asset snapshot and plan withdrawal checks.
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
  LOCK TABLE public.savings_goal_plan_withdrawal
    IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.asset_snapshot IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.user_reconciliation IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1
    FROM public.user_reconciliation r
    WHERE r.user_id = p_user_id AND r.starting_amount IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'rekey: starting amount requires v4'
      USING ERRCODE = 'P0001';
  END IF;

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

  PERFORM public.rekey_user_encrypted_data_with_starting_amount(
    p_user_id,
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    p_budget_lines,
    p_transactions,
    p_template_lines,
    p_savings_goals,
    p_monthly_budgets,
    p_key_check
  );
END;
$$;
