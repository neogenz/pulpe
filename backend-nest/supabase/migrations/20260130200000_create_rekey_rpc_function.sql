-- Atomic re-encryption RPC function for password change rekey flow.
-- Applies pre-computed encrypted values across all 5 tables in a single transaction.
-- Called from EncryptionRekeyService after Node.js computes new ciphertexts.

CREATE OR REPLACE FUNCTION public.rekey_user_encrypted_data(
  p_budget_lines jsonb DEFAULT '[]'::jsonb,
  p_transactions jsonb DEFAULT '[]'::jsonb,
  p_template_lines jsonb DEFAULT '[]'::jsonb,
  p_savings_goals jsonb DEFAULT '[]'::jsonb,
  p_monthly_budgets jsonb DEFAULT '[]'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  -- Batch update budget_lines
  IF jsonb_array_length(p_budget_lines) > 0 THEN
    UPDATE public.budget_line bl
    SET amount_encrypted = item.amount_encrypted
    FROM jsonb_to_recordset(p_budget_lines) AS item(id uuid, amount_encrypted text)
    WHERE bl.id = item.id;
  END IF;

  -- Batch update transactions
  IF jsonb_array_length(p_transactions) > 0 THEN
    UPDATE public.transaction t
    SET amount_encrypted = item.amount_encrypted
    FROM jsonb_to_recordset(p_transactions) AS item(id uuid, amount_encrypted text)
    WHERE t.id = item.id;
  END IF;

  -- Batch update template_lines
  IF jsonb_array_length(p_template_lines) > 0 THEN
    UPDATE public.template_line tl
    SET amount_encrypted = item.amount_encrypted
    FROM jsonb_to_recordset(p_template_lines) AS item(id uuid, amount_encrypted text)
    WHERE tl.id = item.id;
  END IF;

  -- Batch update savings_goals
  IF jsonb_array_length(p_savings_goals) > 0 THEN
    UPDATE public.savings_goal sg
    SET target_amount_encrypted = item.target_amount_encrypted
    FROM jsonb_to_recordset(p_savings_goals) AS item(id uuid, target_amount_encrypted text)
    WHERE sg.id = item.id;
  END IF;

  -- Batch update monthly_budgets
  IF jsonb_array_length(p_monthly_budgets) > 0 THEN
    UPDATE public.monthly_budget mb
    SET ending_balance_encrypted = item.ending_balance_encrypted
    FROM jsonb_to_recordset(p_monthly_budgets) AS item(id uuid, ending_balance_encrypted text)
    WHERE mb.id = item.id;
  END IF;
END;
$$;
