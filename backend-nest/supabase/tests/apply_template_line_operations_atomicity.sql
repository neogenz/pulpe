-- Integration test for apply_template_line_operations RPC.
-- Validates partial-patch UPDATE, INSERT, DELETE, and budget propagation
-- inside a single SECURITY DEFINER function call. Wraps in a transaction
-- and rolls back at the end so DB state is unaffected.

BEGIN;

-- Test user — created via auth.users so auth.uid() resolves correctly.
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_existing_line_id uuid := gen_random_uuid();
  v_to_delete_line_id uuid := gen_random_uuid();
  v_new_line_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_existing_budget_line_id uuid := gen_random_uuid();
  v_to_delete_budget_line_id uuid := gen_random_uuid();
  v_result uuid[];
  v_check_name text;
  v_check_amount text;
  v_check_kind public.transaction_kind;
  v_check_count int;
  v_budget_check_name text;
  v_budget_check_amount text;
BEGIN
  -- Set up authenticated context so auth.uid() returns our test user.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_id::text)::text,
    true
  );

  -- Create the auth user row (FK target for template.user_id).
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES (
    v_user_id,
    'test-rpc@local.test',
    'fake',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  );

  -- Seed: template owned by test user.
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_user_id, 'Test Template', 'rpc test', false);

  -- Seed: existing template line that we'll partial-patch update.
  -- Use a fake-but-structurally-valid ciphertext string for amount (column is text).
  INSERT INTO public.template_line (
    id, template_id, name, amount, kind, recurrence, description
  )
  VALUES (
    v_existing_line_id,
    v_template_id,
    'Original Name',
    'CIPHERTEXT_ORIGINAL',
    'income',
    'fixed',
    'Original description'
  );

  -- Seed: template line that we'll delete.
  INSERT INTO public.template_line (
    id, template_id, name, amount, kind, recurrence
  )
  VALUES (
    v_to_delete_line_id,
    v_template_id,
    'To Delete',
    'CIPHERTEXT_DELETE',
    'expense',
    'fixed'
  );

  -- Seed: budget for propagation.
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_budget_id, v_user_id, v_template_id, 6, 2026, 'June 2026');

  -- Seed: budget line referencing the existing template line (will be propagated UPDATE).
  INSERT INTO public.budget_line (
    id, budget_id, template_line_id, name, amount, kind, recurrence, is_manually_adjusted
  )
  VALUES (
    v_existing_budget_line_id,
    v_budget_id,
    v_existing_line_id,
    'Original BL Name',
    'CIPHERTEXT_BL_ORIGINAL',
    'income',
    'fixed',
    false
  );

  -- Seed: budget line referencing the to-delete template line (will be deleted by propagation).
  INSERT INTO public.budget_line (
    id, budget_id, template_line_id, name, amount, kind, recurrence, is_manually_adjusted
  )
  VALUES (
    v_to_delete_budget_line_id,
    v_budget_id,
    v_to_delete_line_id,
    'To Delete BL',
    'CIPHERTEXT_BL_DELETE',
    'expense',
    'fixed',
    false
  );

  -- ---------- INVOKE THE RPC ----------
  v_result := public.apply_template_line_operations(
    template_id := v_template_id,
    budget_ids := ARRAY[v_budget_id]::uuid[],
    delete_ids := ARRAY[v_to_delete_line_id]::uuid[],
    updated_lines := jsonb_build_array(
      jsonb_build_object(
        'id', v_existing_line_id,
        'name', 'Updated Name'
        -- intentionally only patch `name` — all other fields must be preserved
      )
    ),
    created_lines := jsonb_build_array(
      jsonb_build_object(
        'id', v_new_line_id,
        'name', 'New Line',
        'amount', 'CIPHERTEXT_NEW',
        'kind', 'expense',
        'recurrence', 'one_off',
        'description', 'created via rpc'
      )
    )
  );

  -- ---------- ASSERTIONS ----------

  -- 1. Partial UPDATE: name changed, amount preserved (CIPHERTEXT_ORIGINAL),
  --    kind preserved (income), description preserved (Original description).
  SELECT name, amount, kind
  INTO v_check_name, v_check_amount, v_check_kind
  FROM public.template_line WHERE id = v_existing_line_id;

  IF v_check_name <> 'Updated Name' THEN
    RAISE EXCEPTION 'FAIL: template_line.name expected "Updated Name", got "%"', v_check_name;
  END IF;
  IF v_check_amount <> 'CIPHERTEXT_ORIGINAL' THEN
    RAISE EXCEPTION 'FAIL: template_line.amount must be preserved (partial patch), got "%"', v_check_amount;
  END IF;
  IF v_check_kind <> 'income' THEN
    RAISE EXCEPTION 'FAIL: template_line.kind must be preserved, got "%"', v_check_kind;
  END IF;

  -- 2. INSERT: new template line was created with caller-supplied id.
  SELECT name, amount INTO v_check_name, v_check_amount
  FROM public.template_line WHERE id = v_new_line_id;

  IF v_check_name <> 'New Line' THEN
    RAISE EXCEPTION 'FAIL: created template_line.name expected "New Line", got "%"', v_check_name;
  END IF;
  IF v_check_amount <> 'CIPHERTEXT_NEW' THEN
    RAISE EXCEPTION 'FAIL: created template_line.amount expected "CIPHERTEXT_NEW", got "%"', v_check_amount;
  END IF;

  -- 3. DELETE: to-delete template line is gone.
  SELECT count(*) INTO v_check_count
  FROM public.template_line WHERE id = v_to_delete_line_id;
  IF v_check_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: template_line was not deleted, count = %', v_check_count;
  END IF;

  -- 4. Propagation UPDATE: budget_line.name updated, budget_line.amount preserved.
  SELECT name, amount INTO v_budget_check_name, v_budget_check_amount
  FROM public.budget_line WHERE id = v_existing_budget_line_id;

  IF v_budget_check_name <> 'Updated Name' THEN
    RAISE EXCEPTION 'FAIL: budget_line.name expected "Updated Name", got "%"', v_budget_check_name;
  END IF;
  IF v_budget_check_amount <> 'CIPHERTEXT_BL_ORIGINAL' THEN
    RAISE EXCEPTION 'FAIL: budget_line.amount must be preserved (partial patch), got "%"', v_budget_check_amount;
  END IF;

  -- 5. Propagation DELETE: budget_line for deleted template_line is gone.
  SELECT count(*) INTO v_check_count
  FROM public.budget_line WHERE id = v_to_delete_budget_line_id;
  IF v_check_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: budget_line was not deleted via propagation, count = %', v_check_count;
  END IF;

  -- 6. Propagation INSERT: new budget_line created referencing the new template_line.
  SELECT count(*) INTO v_check_count
  FROM public.budget_line
  WHERE template_line_id = v_new_line_id AND budget_id = v_budget_id;
  IF v_check_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: new budget_line not inserted via propagation, count = %', v_check_count;
  END IF;

  -- 7. Return value: affected_budget_ids contains our budget.
  IF NOT (v_budget_id = ANY(v_result)) THEN
    RAISE EXCEPTION 'FAIL: returned affected_budget_ids missing budget %', v_budget_id;
  END IF;

  RAISE NOTICE 'ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
