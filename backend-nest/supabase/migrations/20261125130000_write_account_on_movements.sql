-- pulpe:migration-phase contract
-- pulpe:safe-after v0.66.2
-- Mon patrimoine (PUL-378): the RPCs that rewrite every column of a movement
-- keep or write its account (`account_id`, added by 20261125120000).
--
-- Bodies taken from the local database (`pg_get_functiondef`), one column
-- added each; mode, `search_path` and grants are unchanged (CREATE OR REPLACE
-- keeps the ACL).
--
-- - `update_budget_line_with_tags`, `update_transaction_with_tags`: the patch
--   is laid over the current row, so an absent key keeps the account and an
--   explicit null clears it. The deployed backend never sends the key.
-- - `create_savings_goal_withdrawal`, `update_savings_goal_withdrawal`: a
--   withdrawal income can name its account. Still SECURITY DEFINER behind
--   `lock_savings_goal_for_withdrawal`; the `enforce_account_link` trigger
--   refuses an account the budget's owner does not hold, whatever the mode.

CREATE OR REPLACE FUNCTION public.update_budget_line_with_tags(p_budget_line_id uuid, p_patch jsonb, p_tag_ids uuid[])
 RETURNS budget_line
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  current_row public.budget_line%ROWTYPE;
  patched_row public.budget_line%ROWTYPE;
BEGIN
  SELECT source.*
  INTO current_row
  FROM public.budget_line AS source
  WHERE source.id = p_budget_line_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget line not found' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_patch, '{}'::jsonb) <> '{}'::jsonb THEN
    SELECT populated.*
    INTO patched_row
    FROM jsonb_populate_record(current_row, p_patch) AS populated;

    UPDATE public.budget_line AS target
    SET
      template_line_id = patched_row.template_line_id,
      savings_goal_id = patched_row.savings_goal_id,
      asset_id = patched_row.asset_id,
      account_id = patched_row.account_id,
      name = patched_row.name,
      amount = patched_row.amount,
      original_amount = patched_row.original_amount,
      original_currency = patched_row.original_currency,
      target_currency = patched_row.target_currency,
      exchange_rate = patched_row.exchange_rate,
      kind = patched_row.kind,
      recurrence = patched_row.recurrence,
      is_manually_adjusted = patched_row.is_manually_adjusted,
      checked_at = patched_row.checked_at,
      updated_at = patched_row.updated_at
    WHERE target.id = p_budget_line_id
    RETURNING target.* INTO current_row;
  END IF;

  DELETE FROM public.budget_line_tag AS link
  WHERE link.budget_line_id = p_budget_line_id;

  INSERT INTO public.budget_line_tag (budget_line_id, tag_id)
  SELECT p_budget_line_id, tag_id
  FROM unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[])) AS tag_id;

  RETURN current_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_transaction_with_tags(p_transaction_id uuid, p_patch jsonb, p_tag_ids uuid[])
 RETURNS transaction
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  current_row public.transaction%ROWTYPE;
  patched_row public.transaction%ROWTYPE;
BEGIN
  SELECT source.*
  INTO current_row
  FROM public.transaction AS source
  WHERE source.id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_patch, '{}'::jsonb) <> '{}'::jsonb THEN
    SELECT populated.*
    INTO patched_row
    FROM jsonb_populate_record(current_row, p_patch) AS populated;

    UPDATE public.transaction AS target
    SET
      account_id = patched_row.account_id,
      name = patched_row.name,
      amount = patched_row.amount,
      original_amount = patched_row.original_amount,
      original_currency = patched_row.original_currency,
      target_currency = patched_row.target_currency,
      exchange_rate = patched_row.exchange_rate,
      kind = patched_row.kind,
      transaction_date = patched_row.transaction_date,
      checked_at = patched_row.checked_at,
      updated_at = patched_row.updated_at
    WHERE target.id = p_transaction_id
    RETURNING target.* INTO current_row;
  END IF;

  DELETE FROM public.transaction_tag AS link
  WHERE link.transaction_id = p_transaction_id;

  INSERT INTO public.transaction_tag (transaction_id, tag_id)
  SELECT p_transaction_id, tag_id
  FROM unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[])) AS tag_id;

  RETURN current_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_savings_goal_withdrawal(p_goal_id uuid, p_expected_revision bigint, p_transaction jsonb, p_tag_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS transaction
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_goal_name text;
  v_input public.transaction%ROWTYPE;
  v_row public.transaction%ROWTYPE;
BEGIN
  v_goal_name := public.lock_savings_goal_for_withdrawal(
    p_goal_id,
    p_expected_revision
  );

  SELECT populated.*
  INTO v_input
  FROM jsonb_populate_record(NULL::public.transaction, p_transaction) AS populated;

  IF v_input.kind IS DISTINCT FROM 'income'::public.transaction_kind THEN
    RAISE EXCEPTION 'Savings goal withdrawal must be an income'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.monthly_budget mb
  WHERE mb.id = v_input.budget_id AND mb.user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget access denied' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_savings_goal_withdrawal_tags(p_tag_ids);

  INSERT INTO public.transaction (
    id,
    budget_id,
    budget_line_id,
    account_id,
    name,
    amount,
    original_amount,
    original_currency,
    target_currency,
    exchange_rate,
    kind,
    transaction_date,
    checked_at,
    source_savings_goal_id,
    source_savings_goal_name
  ) VALUES (
    COALESCE(v_input.id, gen_random_uuid()),
    v_input.budget_id,
    v_input.budget_line_id,
    v_input.account_id,
    v_input.name,
    v_input.amount,
    v_input.original_amount,
    v_input.original_currency,
    v_input.target_currency,
    v_input.exchange_rate,
    v_input.kind,
    COALESCE(v_input.transaction_date, now()),
    v_input.checked_at,
    p_goal_id,
    v_goal_name
  )
  RETURNING * INTO v_row;

  INSERT INTO public.transaction_tag (transaction_id, tag_id)
  SELECT v_row.id, tag_id
  FROM unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[])) AS tag_id;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_savings_goal_withdrawal(p_transaction_id uuid, p_expected_revision bigint, p_patch jsonb, p_tag_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS transaction
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_goal_id uuid;
  v_goal_name text;
  v_current public.transaction%ROWTYPE;
  v_patched public.transaction%ROWTYPE;
  v_row public.transaction%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT tx.source_savings_goal_id
  INTO v_goal_id
  FROM public.transaction tx
  JOIN public.monthly_budget mb ON mb.id = tx.budget_id
  WHERE tx.id = p_transaction_id AND mb.user_id = v_uid;

  IF v_goal_id IS NULL THEN
    RAISE EXCEPTION 'Savings goal withdrawal not found' USING ERRCODE = 'P0001';
  END IF;

  -- Goal lock first, transaction row lock second: same order as every other
  -- savings-goal RPC, so concurrent writers queue instead of deadlocking.
  v_goal_name := public.lock_savings_goal_for_withdrawal(
    v_goal_id,
    p_expected_revision
  );

  SELECT source.*
  INTO v_current
  FROM public.transaction AS source
  WHERE source.id = p_transaction_id
  FOR UPDATE;

  IF v_current.source_savings_goal_id IS DISTINCT FROM v_goal_id THEN
    RAISE EXCEPTION 'Savings goal withdrawal source changed'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_savings_goal_withdrawal_tags(p_tag_ids);

  SELECT populated.*
  INTO v_patched
  FROM jsonb_populate_record(v_current, COALESCE(p_patch, '{}'::jsonb)) AS populated;

  IF v_patched.kind IS DISTINCT FROM 'income'::public.transaction_kind THEN
    RAISE EXCEPTION 'Savings goal withdrawal must be an income'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_patched.budget_line_id IS DISTINCT FROM v_current.budget_line_id THEN
    RAISE EXCEPTION 'Savings goal withdrawal allocation is immutable'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_patched.budget_id IS DISTINCT FROM v_current.budget_id THEN
    PERFORM 1
    FROM public.monthly_budget mb
    WHERE mb.id = v_patched.budget_id AND mb.user_id = v_uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Budget access denied' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.transaction AS target
  SET
    budget_id = v_patched.budget_id,
    account_id = v_patched.account_id,
    name = v_patched.name,
    amount = v_patched.amount,
    original_amount = v_patched.original_amount,
    original_currency = v_patched.original_currency,
    target_currency = v_patched.target_currency,
    exchange_rate = v_patched.exchange_rate,
    transaction_date = v_patched.transaction_date,
    checked_at = v_patched.checked_at,
    source_savings_goal_name = v_goal_name,
    updated_at = now()
  WHERE target.id = p_transaction_id
  RETURNING target.* INTO v_row;

  IF p_tag_ids IS NOT NULL THEN
    DELETE FROM public.transaction_tag AS link
    WHERE link.transaction_id = p_transaction_id;

    INSERT INTO public.transaction_tag (transaction_id, tag_id)
    SELECT p_transaction_id, tag_id
    FROM unnest(p_tag_ids) AS tag_id;
  END IF;

  RETURN v_row;
END;
$function$;
