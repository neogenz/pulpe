-- Review hardening for savings-goal plan withdrawals.
--
-- 1. A rolling-deploy backend that still calls the historical rekey RPC must
--    fail closed before touching any ciphertext once a plan-only withdrawal
--    exists. The v2 wrapper rekeys every table and writes key_check last.
-- 2. Every plan RPC now takes the same per-goal lock and row-lock order as a
--    withdrawal realization. The additive five-argument destination RPC also
--    compares the balance revision that the backend read before decrypting and
--    validating the projected stock.

-- ---------------------------------------------------------------------------
-- 1. Rekey: one historical core, a fail-closed legacy wrapper, one complete v2
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.rekey_user_encrypted_data(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text
) RENAME TO rekey_user_encrypted_data_core;

REVOKE ALL ON FUNCTION public.rekey_user_encrypted_data_core(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rekey_user_encrypted_data(
  p_user_id uuid,
  p_budget_lines jsonb DEFAULT '[]'::jsonb,
  p_transactions jsonb DEFAULT '[]'::jsonb,
  p_template_lines jsonb DEFAULT '[]'::jsonb,
  p_savings_goals jsonb DEFAULT '[]'::jsonb,
  p_monthly_budgets jsonb DEFAULT '[]'::jsonb,
  p_key_check text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Prevent a plan row from appearing between the fail-closed check and the
  -- core/key_check update. Rekeys are rare; a short table lock is safer than a
  -- per-session flag that another deployment could bypass.
  LOCK TABLE public.savings_goal_plan_withdrawal
    IN SHARE ROW EXCLUSIVE MODE;

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
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_expected integer := jsonb_array_length(p_plan_withdrawals);
  v_rows integer;
BEGIN
  LOCK TABLE public.savings_goal_plan_withdrawal
    IN SHARE ROW EXCLUSIVE MODE;

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

ALTER FUNCTION public.rekey_user_encrypted_data(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text
) OWNER TO postgres;
ALTER FUNCTION public.rekey_user_encrypted_data_with_plan_withdrawals(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.rekey_user_encrypted_data(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rekey_user_encrypted_data_with_plan_withdrawals(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rekey_user_encrypted_data(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.rekey_user_encrypted_data_with_plan_withdrawals(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text
) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Plan apply: common lock order for legacy callers and additive revision CAS
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  RENAME TO apply_savings_goal_plan_core;
REVOKE ALL ON FUNCTION public.apply_savings_goal_plan_core(uuid, int, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('savings_goal_withdrawal'),
    hashtext(p_goal_id::text)
  );
  PERFORM 1
  FROM public.savings_goal sg
  WHERE sg.id = p_goal_id AND sg.user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.apply_savings_goal_plan_core(
    p_goal_id, p_min_period_index, p_line_updates, p_plan_withdrawals
  );
END;
$$;

ALTER FUNCTION public.apply_savings_goal_plan_with_destinations(
  uuid, int, jsonb, jsonb
) RENAME TO apply_savings_goal_plan_with_destinations_core;
REVOKE ALL ON FUNCTION public.apply_savings_goal_plan_with_destinations_core(
  uuid, int, jsonb, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

-- Compatibility entry point for already deployed clients. It cannot provide
-- a revision CAS, but it does serialize with realizations and therefore cannot
-- interleave its representation changes with a Real write.
CREATE OR REPLACE FUNCTION public.apply_savings_goal_plan_with_destinations(
  p_goal_id uuid,
  p_min_period_index int,
  p_line_updates jsonb DEFAULT '[]'::jsonb,
  p_plan_withdrawals jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('savings_goal_withdrawal'),
    hashtext(p_goal_id::text)
  );
  PERFORM 1
  FROM public.savings_goal sg
  WHERE sg.id = p_goal_id AND sg.user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  RETURN public.apply_savings_goal_plan_with_destinations_core(
    p_goal_id, p_min_period_index, p_line_updates, p_plan_withdrawals
  );
END;
$$;

-- Current backend entry point. The expected revision was read before the
-- decrypted balance inputs; the shared withdrawal lock validates it under the
-- goal row lock before any plan representation can change.
CREATE OR REPLACE FUNCTION public.apply_savings_goal_plan_with_destinations(
  p_goal_id uuid,
  p_min_period_index int,
  p_line_updates jsonb,
  p_plan_withdrawals jsonb,
  p_expected_revision bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.lock_savings_goal_for_withdrawal(
    p_goal_id, p_expected_revision
  );
  RETURN public.apply_savings_goal_plan_with_destinations_core(
    p_goal_id, p_min_period_index, p_line_updates, p_plan_withdrawals
  );
END;
$$;

ALTER FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  OWNER TO postgres;
ALTER FUNCTION public.apply_savings_goal_plan_with_destinations(
  uuid, int, jsonb, jsonb
) OWNER TO postgres;
ALTER FUNCTION public.apply_savings_goal_plan_with_destinations(
  uuid, int, jsonb, jsonb, bigint
) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_plan_with_destinations(
  uuid, int, jsonb, jsonb
) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_plan_with_destinations(
  uuid, int, jsonb, jsonb, bigint
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_savings_goal_plan_with_destinations(
  uuid, int, jsonb, jsonb
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_savings_goal_plan_with_destinations(
  uuid, int, jsonb, jsonb, bigint
) TO authenticated, service_role;
