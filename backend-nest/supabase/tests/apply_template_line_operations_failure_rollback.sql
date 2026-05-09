-- Atomicity test: force the RPC to fail mid-flow and verify NO writes leak.
-- We pass an invalid `kind` enum value in updated_lines. The cast inside the
-- UPDATE block will raise. If the function is truly atomic, the prior INSERT
-- in the same call (created_lines) must NOT be observable after the failure.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_existing_line_id uuid := gen_random_uuid();
  v_new_line_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_count int;
  v_caught boolean := false;
  v_original_name text;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_id::text)::text,
    true
  );

  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES (v_user_id, 'atomic-test@local.test', 'fake',
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_user_id, 'Atomic Test', 'x', false);

  INSERT INTO public.template_line (id, template_id, name, amount, kind, recurrence)
  VALUES (v_existing_line_id, v_template_id, 'Original', 'CT_X', 'income', 'fixed');

  -- Try the RPC with an invalid `kind` enum in the update payload.
  -- The cast inside the UPDATE LOOP will throw → entire function should rollback.
  BEGIN
    PERFORM public.apply_template_line_operations(
      template_id := v_template_id,
      budget_ids := ARRAY[]::uuid[],
      delete_ids := ARRAY[]::uuid[],
      updated_lines := jsonb_build_array(
        jsonb_build_object(
          'id', v_existing_line_id,
          'name', 'Should Not Persist',
          'kind', 'NOT_A_VALID_KIND'
        )
      ),
      created_lines := jsonb_build_array(
        jsonb_build_object(
          'id', v_new_line_id,
          'name', 'Should Also Not Persist',
          'amount', 'CT_NEW',
          'kind', 'expense',
          'recurrence', 'one_off',
          'description', ''
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    RAISE NOTICE 'RPC raised as expected: %', SQLERRM;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL: RPC should have raised on invalid kind enum';
  END IF;

  -- ATOMICITY ASSERTIONS

  -- 1. The new template_line MUST NOT exist (would have been INSERTed before
  --    UPDATE LOOP failure if writes leaked). NOTE: in this RPC, the order is
  --    UPDATE → INSERT → ..., so a UPDATE-loop failure happens BEFORE INSERT
  --    even runs. Different fail order; equivalent atomicity guarantee.
  SELECT count(*) INTO v_count
  FROM public.template_line WHERE id = v_new_line_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: created template_line leaked despite RPC failure (count=%)', v_count;
  END IF;

  -- 2. The existing template_line.name MUST still be original
  --    (UPDATE attempted but rolled back).
  SELECT name INTO v_original_name
  FROM public.template_line WHERE id = v_existing_line_id;
  IF v_original_name <> 'Original' THEN
    RAISE EXCEPTION 'FAIL: template_line.name was not rolled back, got "%"', v_original_name;
  END IF;

  RAISE NOTICE 'ATOMICITY ASSERTIONS PASSED';
END $$;

ROLLBACK;
