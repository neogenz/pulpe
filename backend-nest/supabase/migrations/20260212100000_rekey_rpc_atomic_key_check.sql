-- Atomic key_check update: allow the SECURITY INVOKER rekey RPC to update
-- key_check within the same transaction as data re-encryption.

-- Column-level privileges for authenticated users:
-- SELECT(user_id) needed for WHERE clause in the RPC function body.
-- UPDATE(key_check, updated_at) for writing the new canary value.
GRANT SELECT (user_id) ON public.user_encryption_key TO authenticated;
GRANT UPDATE (key_check, updated_at) ON public.user_encryption_key TO authenticated;

-- RLS: authenticated can only read/update their own row.
-- Both SELECT and UPDATE policies are required: PostgreSQL needs the SELECT
-- policy for the UPDATE's WHERE clause to "see" the row.
CREATE POLICY "authenticated_select_own_key" ON public.user_encryption_key
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "authenticated_update_own_key_check" ON public.user_encryption_key
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Drop old signature to prevent function overload
DROP FUNCTION IF EXISTS public.rekey_user_encrypted_data(jsonb, jsonb, jsonb, jsonb, jsonb);

-- Re-create with p_key_check parameter + row-count assertion
CREATE OR REPLACE FUNCTION public.rekey_user_encrypted_data(
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
  v_rows integer;
BEGIN
  -- Batch update budget_lines
  IF jsonb_array_length(p_budget_lines) > 0 THEN
    UPDATE public.budget_line bl
    SET amount = 0,
        amount_encrypted = item.amount_encrypted
    FROM jsonb_to_recordset(p_budget_lines) AS item(id uuid, amount_encrypted text)
    WHERE bl.id = item.id;
  END IF;

  -- Batch update transactions
  IF jsonb_array_length(p_transactions) > 0 THEN
    UPDATE public.transaction t
    SET amount = 0,
        amount_encrypted = item.amount_encrypted
    FROM jsonb_to_recordset(p_transactions) AS item(id uuid, amount_encrypted text)
    WHERE t.id = item.id;
  END IF;

  -- Batch update template_lines
  IF jsonb_array_length(p_template_lines) > 0 THEN
    UPDATE public.template_line tl
    SET amount = 0,
        amount_encrypted = item.amount_encrypted
    FROM jsonb_to_recordset(p_template_lines) AS item(id uuid, amount_encrypted text)
    WHERE tl.id = item.id;
  END IF;

  -- Batch update savings_goals
  IF jsonb_array_length(p_savings_goals) > 0 THEN
    UPDATE public.savings_goal sg
    SET target_amount = 0,
        target_amount_encrypted = item.target_amount_encrypted
    FROM jsonb_to_recordset(p_savings_goals) AS item(id uuid, target_amount_encrypted text)
    WHERE sg.id = item.id;
  END IF;

  -- Batch update monthly_budgets
  IF jsonb_array_length(p_monthly_budgets) > 0 THEN
    UPDATE public.monthly_budget mb
    SET ending_balance = 0,
        ending_balance_encrypted = item.ending_balance_encrypted
    FROM jsonb_to_recordset(p_monthly_budgets) AS item(id uuid, ending_balance_encrypted text)
    WHERE mb.id = item.id;
  END IF;

  -- Atomically update key_check within the same transaction
  IF p_key_check IS NOT NULL THEN
    UPDATE public.user_encryption_key
    SET key_check = p_key_check, updated_at = now()
    WHERE user_id = auth.uid();

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    -- auth.uid() is NULL for service_role (admin/migration scripts) — the
    -- WHERE clause legitimately matches 0 rows.  Only assert for authenticated
    -- callers where exactly 1 row must be updated.
    IF v_rows <> 1 AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'rekey_user_encrypted_data: key_check update expected 1 row, got %', v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
END;
$$;
