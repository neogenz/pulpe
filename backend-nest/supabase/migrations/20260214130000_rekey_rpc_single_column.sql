-- Migration: Update rekey_user_encrypted_data for single-column schema
-- After the dual→single column cleanup, the old RPC references dropped
-- columns (amount_encrypted, target_amount_encrypted, ending_balance_encrypted).
-- This migration recreates it with the correct single-column names and adds
-- strict ROW_COUNT assertions so that any id mismatch triggers a full rollback.
--
-- GRANTs and RLS policies on user_encryption_key already exist
-- (migration 20260212100000) and are NOT recreated here.

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
  v_expected integer;
BEGIN
  -- budget_line.amount
  v_expected := jsonb_array_length(p_budget_lines);
  IF v_expected > 0 THEN
    UPDATE public.budget_line bl
    SET amount = item.amount
    FROM jsonb_to_recordset(p_budget_lines) AS item(id uuid, amount text)
    WHERE bl.id = item.id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected THEN
      RAISE EXCEPTION 'rekey: budget_line expected % rows, got %', v_expected, v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- transaction.amount
  v_expected := jsonb_array_length(p_transactions);
  IF v_expected > 0 THEN
    UPDATE public.transaction t
    SET amount = item.amount
    FROM jsonb_to_recordset(p_transactions) AS item(id uuid, amount text)
    WHERE t.id = item.id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected THEN
      RAISE EXCEPTION 'rekey: transaction expected % rows, got %', v_expected, v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- template_line.amount
  v_expected := jsonb_array_length(p_template_lines);
  IF v_expected > 0 THEN
    UPDATE public.template_line tl
    SET amount = item.amount
    FROM jsonb_to_recordset(p_template_lines) AS item(id uuid, amount text)
    WHERE tl.id = item.id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected THEN
      RAISE EXCEPTION 'rekey: template_line expected % rows, got %', v_expected, v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- savings_goal.target_amount
  v_expected := jsonb_array_length(p_savings_goals);
  IF v_expected > 0 THEN
    UPDATE public.savings_goal sg
    SET target_amount = item.target_amount
    FROM jsonb_to_recordset(p_savings_goals) AS item(id uuid, target_amount text)
    WHERE sg.id = item.id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected THEN
      RAISE EXCEPTION 'rekey: savings_goal expected % rows, got %', v_expected, v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- monthly_budget.ending_balance
  v_expected := jsonb_array_length(p_monthly_budgets);
  IF v_expected > 0 THEN
    UPDATE public.monthly_budget mb
    SET ending_balance = item.ending_balance
    FROM jsonb_to_recordset(p_monthly_budgets) AS item(id uuid, ending_balance text)
    WHERE mb.id = item.id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> v_expected THEN
      RAISE EXCEPTION 'rekey: monthly_budget expected % rows, got %', v_expected, v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- key_check (atomic with the data updates above)
  IF p_key_check IS NOT NULL THEN
    UPDATE public.user_encryption_key
    SET key_check = p_key_check, updated_at = now()
    WHERE user_id = auth.uid();

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    -- auth.uid() is NULL for service_role — skip assertion for admin callers
    IF v_rows <> 1 AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'rekey: key_check update expected 1 row, got %', v_rows
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
END;
$$;
