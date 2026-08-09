-- Retrait planifié directement dans un objectif, sans budget associé.
-- `amount` contient un ciphertext AES-256-GCM POSITIF ; le signe reste une
-- convention du wire et n'est jamais persisté en clair.

CREATE TABLE public.savings_goal_plan_withdrawal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_goal_id uuid NOT NULL
    REFERENCES public.savings_goal(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year BETWEEN 1 AND 9999),
  amount text NOT NULL CHECK (btrim(amount) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT savings_goal_plan_withdrawal_period_unique
    UNIQUE (savings_goal_id, year, month)
);

CREATE INDEX savings_goal_plan_withdrawal_user_id_idx
  ON public.savings_goal_plan_withdrawal(user_id);

CREATE TRIGGER update_savings_goal_plan_withdrawal_updated_at
  BEFORE UPDATE ON public.savings_goal_plan_withdrawal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- La colonne user_id accélère RLS et le rekey, mais ne doit jamais diverger du
-- propriétaire de l'objectif. Le trigger ferme aussi les écritures PostgREST
-- directes qui tenteraient de croiser deux tenants.
CREATE OR REPLACE FUNCTION public.enforce_savings_goal_plan_withdrawal_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT sg.user_id INTO v_owner_id
  FROM public.savings_goal sg
  WHERE sg.id = NEW.savings_goal_id;

  IF v_owner_id IS NULL OR NEW.user_id IS DISTINCT FROM v_owner_id THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_savings_goal_plan_withdrawal_owner()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_savings_goal_plan_withdrawal_owner()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_savings_goal_plan_withdrawal_owner
  BEFORE INSERT OR UPDATE OF savings_goal_id, user_id
  ON public.savings_goal_plan_withdrawal
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_savings_goal_plan_withdrawal_owner();

ALTER TABLE public.savings_goal_plan_withdrawal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own savings goal plan withdrawals"
  ON public.savings_goal_plan_withdrawal
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can create own savings goal plan withdrawals"
  ON public.savings_goal_plan_withdrawal
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own savings goal plan withdrawals"
  ON public.savings_goal_plan_withdrawal
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own savings goal plan withdrawals"
  ON public.savings_goal_plan_withdrawal
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.savings_goal_plan_withdrawal TO authenticated;

-- Toute modification change la projection certifiée par balance_revision.
CREATE OR REPLACE FUNCTION public.bump_savings_goal_revision_from_plan_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_goal_ids uuid[] := '{}'::uuid[];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_goal_ids := v_goal_ids || OLD.savings_goal_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_goal_ids := v_goal_ids || NEW.savings_goal_id;
  END IF;
  PERFORM public.bump_savings_goal_balance_revision(v_goal_ids);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

ALTER FUNCTION public.bump_savings_goal_revision_from_plan_withdrawal()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.bump_savings_goal_revision_from_plan_withdrawal()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER bump_savings_goal_revision_from_plan_withdrawal
  AFTER INSERT OR UPDATE OR DELETE
  ON public.savings_goal_plan_withdrawal
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_savings_goal_revision_from_plan_withdrawal();

-- Même transaction pour les contributions matérialisées et les retraits
-- directs. `amount = null` supprime la période ; sinon le ciphertext positif
-- est upserté. L'ancienne forme à trois arguments est remplacée par une forme
-- compatible dont le quatrième argument possède une valeur par défaut.
DROP FUNCTION IF EXISTS public.apply_savings_goal_plan(uuid, int, jsonb);

CREATE OR REPLACE FUNCTION public.apply_savings_goal_plan(
  p_goal_id uuid,
  p_min_period_index int,
  p_line_updates jsonb DEFAULT '[]'::jsonb,
  p_plan_withdrawals jsonb DEFAULT '[]'::jsonb
) RETURNS SETOF public.budget_line
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_updated_ids uuid[];
  v_line_count integer;
  v_expected_line_count integer := jsonb_array_length(p_line_updates);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('apply_savings_goal_plan'),
    hashtext(p_goal_id::text)
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.savings_goal
    WHERE id = p_goal_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_plan_withdrawals)
      AS p(month integer, year integer, amount text)
    WHERE p.month IS NULL
      OR p.year IS NULL
      OR p.month NOT BETWEEN 1 AND 12
      OR p.year NOT BETWEEN 1 AND 9999
      OR (p.year * 12 + p.month) < p_min_period_index
      OR (p.amount IS NOT NULL AND btrim(p.amount) = '')
  ) THEN
    RAISE EXCEPTION 'Plan line in past period' USING ERRCODE = 'P0001';
  END IF;

  IF (
    SELECT count(*)
    FROM jsonb_to_recordset(p_plan_withdrawals)
      AS p(month integer, year integer, amount text)
  ) IS DISTINCT FROM (
    SELECT count(*)
    FROM (
      SELECT DISTINCT p.month, p.year
      FROM jsonb_to_recordset(p_plan_withdrawals)
        AS p(month integer, year integer, amount text)
    ) unique_periods
  ) THEN
    RAISE EXCEPTION 'Plan withdrawal duplicate period' USING ERRCODE = 'P0001';
  END IF;

  WITH updated AS (
    UPDATE public.budget_line bl
    SET amount = u.amount,
        original_amount = NULL,
        original_currency = NULL,
        exchange_rate = NULL,
        is_manually_adjusted = true,
        updated_at = now()
    FROM jsonb_to_recordset(p_line_updates)
      AS u(budget_line_id uuid, amount text),
      public.monthly_budget mb
    WHERE bl.id = u.budget_line_id
      AND mb.id = bl.budget_id
      AND mb.user_id = v_uid
      AND bl.savings_goal_id = p_goal_id
      AND bl.kind = 'saving'::public.transaction_kind
      AND bl.checked_at IS NULL
      AND (mb.year * 12 + mb.month) >= p_min_period_index
    RETURNING bl.id
  )
  SELECT array_agg(id) INTO v_updated_ids FROM updated;

  v_line_count := COALESCE(array_length(v_updated_ids, 1), 0);
  IF v_line_count <> v_expected_line_count THEN
    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_line_updates) AS u(budget_line_id uuid, amount text)
      LEFT JOIN public.budget_line bl
        ON bl.id = u.budget_line_id
        AND bl.savings_goal_id = p_goal_id
        AND bl.kind = 'saving'::public.transaction_kind
      LEFT JOIN public.monthly_budget mb
        ON mb.id = bl.budget_id AND mb.user_id = v_uid
      WHERE bl.id IS NULL OR mb.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Plan line not linked' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_line_updates) AS u(budget_line_id uuid, amount text)
      JOIN public.budget_line bl ON bl.id = u.budget_line_id
      JOIN public.monthly_budget mb ON mb.id = bl.budget_id AND mb.user_id = v_uid
      WHERE bl.savings_goal_id = p_goal_id
        AND bl.kind = 'saving'::public.transaction_kind
        AND bl.checked_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Plan line already checked' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_line_updates) AS u(budget_line_id uuid, amount text)
      JOIN public.budget_line bl ON bl.id = u.budget_line_id
      JOIN public.monthly_budget mb ON mb.id = bl.budget_id AND mb.user_id = v_uid
      WHERE bl.savings_goal_id = p_goal_id
        AND bl.kind = 'saving'::public.transaction_kind
        AND (mb.year * 12 + mb.month) < p_min_period_index
    ) THEN
      RAISE EXCEPTION 'Plan line in past period' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'Plan line not linked' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.savings_goal_plan_withdrawal w
  USING jsonb_to_recordset(p_plan_withdrawals)
    AS p(month integer, year integer, amount text)
  WHERE w.savings_goal_id = p_goal_id
    AND w.user_id = v_uid
    AND w.month = p.month
    AND w.year = p.year
    AND p.amount IS NULL;

  INSERT INTO public.savings_goal_plan_withdrawal (
    savings_goal_id, user_id, month, year, amount
  )
  SELECT p_goal_id, v_uid, p.month, p.year, p.amount
  FROM jsonb_to_recordset(p_plan_withdrawals)
    AS p(month integer, year integer, amount text)
  WHERE p.amount IS NOT NULL
  ON CONFLICT (savings_goal_id, year, month)
  DO UPDATE SET amount = EXCLUDED.amount, updated_at = now();

  RETURN QUERY
  SELECT bl.* FROM public.budget_line bl
  WHERE bl.id = ANY(v_updated_ids);
END;
$$;

ALTER FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  TO authenticated, service_role;

-- Extension atomique du rekey. L'ancien nom/signature reste disponible pour
-- un backend en cours de rolling deploy ; le nouveau wrapper appelle l'ancien
-- dans la même transaction puis re-chiffre la nouvelle table avant commit.
CREATE OR REPLACE FUNCTION public.rekey_user_encrypted_data_with_plan_withdrawals(
  p_user_id uuid,
  p_plan_withdrawals jsonb DEFAULT '[]'::jsonb,
  p_budget_lines jsonb DEFAULT '[]'::jsonb,
  p_transactions jsonb DEFAULT '[]'::jsonb,
  p_template_lines jsonb DEFAULT '[]'::jsonb,
  p_savings_goals jsonb DEFAULT '[]'::jsonb,
  p_monthly_budgets jsonb DEFAULT '[]'::jsonb,
  p_key_check text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_expected integer := jsonb_array_length(p_plan_withdrawals);
  v_rows integer;
BEGIN
  PERFORM public.rekey_user_encrypted_data(
    p_user_id,
    p_budget_lines,
    p_transactions,
    p_template_lines,
    p_savings_goals,
    p_monthly_budgets,
    p_key_check
  );

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
END;
$$;

ALTER FUNCTION public.rekey_user_encrypted_data_with_plan_withdrawals(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rekey_user_encrypted_data_with_plan_withdrawals(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rekey_user_encrypted_data_with_plan_withdrawals(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) TO service_role;
