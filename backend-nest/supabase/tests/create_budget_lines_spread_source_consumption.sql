-- Regression test for PUL-17 source-backed spread atomicity.
-- A consumed source must make a retry fail before any second fan-out is inserted,
-- and callers must not provide both source kinds in one request.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_source_id uuid := gen_random_uuid();
  v_first_group_id uuid := gen_random_uuid();
  v_retry_group_id uuid := gen_random_uuid();
  v_invalid_group_id uuid := gen_random_uuid();
  v_lines jsonb;
  v_caught boolean;
  v_count int;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES (
    v_user_id,
    'spread-source-consumption@local.test',
    'fake',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  );

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_id::text)::text,
    true
  );

  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_user_id, 'Spread Test', '', false);

  INSERT INTO public.monthly_budget (
    id, user_id, template_id, month, year, description
  ) VALUES (
    v_budget_id, v_user_id, v_template_id, 6, 2026, 'June 2026'
  );

  INSERT INTO public.budget_line (
    id, budget_id, name, amount, kind, recurrence
  ) VALUES (
    v_source_id,
    v_budget_id,
    'Source',
    'CIPHERTEXT_SOURCE',
    'expense',
    'one_off'
  );

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'budget_id', v_budget_id,
      'name', 'Spread tranche',
      'amount', 'CIPHERTEXT_TRANCHE',
      'kind', 'expense',
      'recurrence', 'one_off'
    )
  );

  PERFORM public.create_budget_lines_spread(
    p_spread_group_id := v_first_group_id,
    p_lines := v_lines,
    p_source_budget_line_id := v_source_id
  );

  SELECT count(*) INTO v_count
  FROM public.budget_line
  WHERE spread_group_id = v_first_group_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: first fan-out expected 1 line, got %', v_count;
  END IF;

  v_caught := false;
  BEGIN
    PERFORM public.create_budget_lines_spread(
      p_spread_group_id := v_retry_group_id,
      p_lines := v_lines,
      p_source_budget_line_id := v_source_id
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL: retry with an already-consumed source did not raise';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.budget_line
  WHERE spread_group_id = v_retry_group_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: retry inserted % duplicate line(s)', v_count;
  END IF;

  v_caught := false;
  BEGIN
    PERFORM public.create_budget_lines_spread(
      p_spread_group_id := v_invalid_group_id,
      p_lines := v_lines,
      p_source_budget_line_id := gen_random_uuid(),
      p_source_transaction_id := gen_random_uuid()
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL: providing both source kinds did not raise';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.budget_line
  WHERE spread_group_id = v_invalid_group_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: invalid dual-source call inserted % line(s)', v_count;
  END IF;

  RAISE NOTICE 'SOURCE CONSUMPTION: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
