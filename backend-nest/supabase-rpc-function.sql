-- RPC function to create budget with transactions atomically
-- This should be executed in your Supabase SQL editor or added as a migration

CREATE OR REPLACE FUNCTION create_budget_with_transactions(
  budget_data jsonb,
  transaction_data jsonb[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_budget_id uuid;
  transaction jsonb;
  new_transaction_id uuid;
BEGIN
  -- Insert budget
  INSERT INTO budgets (user_id, month, year, description)
  VALUES (
    (budget_data->>'user_id')::uuid,
    (budget_data->>'month')::integer,
    (budget_data->>'year')::integer,
    budget_data->>'description'
  )
  RETURNING id INTO new_budget_id;

  -- Insert each transaction
  FOREACH transaction IN ARRAY transaction_data
  LOOP
    INSERT INTO transactions (
      user_id, 
      budget_id, 
      amount, 
      type, 
      expense_type, 
      description, 
      is_recurring
    )
    VALUES (
      (budget_data->>'user_id')::uuid,
      new_budget_id,
      (transaction->>'amount')::numeric,
      transaction->>'type',
      transaction->>'expense_type',
      transaction->>'description',
      (transaction->>'is_recurring')::boolean
    )
    RETURNING id INTO new_transaction_id;
  END LOOP;

  -- Return the budget ID
  RETURN jsonb_build_object('budget_id', new_budget_id);
END;
$$;