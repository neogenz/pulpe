-- RPC function to create budget with transactions atomically
-- This is the UPDATED version that matches the backend-nest service expectations
-- Applied via MCP Supabase integration

-- Drop old versions if they exist
DROP FUNCTION IF EXISTS create_budget_with_transactions(jsonb, jsonb[]);
DROP FUNCTION IF EXISTS create_budget_with_transactions;

-- Create the corrected function with proper parameter structure
CREATE FUNCTION create_budget_with_transactions(
  p_user_id uuid,
  p_month integer,
  p_year integer,
  p_description text,
  p_monthly_income numeric DEFAULT 0,
  p_housing_costs numeric DEFAULT 0,
  p_health_insurance numeric DEFAULT 0,
  p_leasing_credit numeric DEFAULT 0,
  p_phone_plan numeric DEFAULT 0,
  p_transport_costs numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_budget_id uuid;
  transaction_count integer := 0;
BEGIN
  -- Insert budget
  INSERT INTO budgets (user_id, month, year, description)
  VALUES (p_user_id, p_month, p_year, p_description)
  RETURNING id INTO new_budget_id;

  -- Insert income transaction if provided
  IF p_monthly_income > 0 THEN
    INSERT INTO transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_monthly_income, 'income', 'fixed', 'Revenu mensuel', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Insert housing costs transaction if provided
  IF p_housing_costs > 0 THEN
    INSERT INTO transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_housing_costs, 'expense', 'fixed', 'Loyer', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Insert health insurance transaction if provided
  IF p_health_insurance > 0 THEN
    INSERT INTO transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_health_insurance, 'expense', 'fixed', 'Assurance santé', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Insert leasing credit transaction if provided
  IF p_leasing_credit > 0 THEN
    INSERT INTO transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_leasing_credit, 'expense', 'fixed', 'Crédit leasing', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Insert phone plan transaction if provided
  IF p_phone_plan > 0 THEN
    INSERT INTO transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_phone_plan, 'expense', 'fixed', 'Forfait téléphonique', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Insert transport costs transaction if provided
  IF p_transport_costs > 0 THEN
    INSERT INTO transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_transport_costs, 'expense', 'fixed', 'Frais de transport', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Return budget data with transaction count (matches service expectations)
  RETURN jsonb_build_object(
    'budget', (
      SELECT to_jsonb(b.*) 
      FROM budgets b 
      WHERE b.id = new_budget_id
    ),
    'transactions_created', transaction_count
  );
END;
$$;