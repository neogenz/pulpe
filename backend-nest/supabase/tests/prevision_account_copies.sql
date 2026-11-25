-- The account of a prévision through every RPC that copies or rewrites its
-- columns (PUL-378): `create_budget_from_template` (CA31),
-- `apply_template_line_operations` and its propagation (CA22),
-- `create_budget_lines_spread` (CA23), `create_template_with_lines` and
-- `update_template_line_with_tags`. Run as the owner (`authenticated`).
-- Rolled back at the end.
BEGIN;

SELECT set_config('test.owner_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES (current_setting('test.owner_id')::uuid, 'account-copies-owner@local.test', 'fake',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.owner_id'))::text,
  true
);

DO $$
DECLARE
  v_owner_id uuid := current_setting('test.owner_id')::uuid;
  v_category_id uuid := gen_random_uuid();
  v_compte_id uuid := gen_random_uuid();   -- Compte courant, own
  v_revolut_id uuid := gen_random_uuid();  -- own
  v_template_id uuid := gen_random_uuid();
  v_loyer uuid := gen_random_uuid();       -- template line on Compte courant
  v_courses uuid := gen_random_uuid();     -- template line without account
  v_salaire uuid := gen_random_uuid();     -- template line created by the bulk RPC
  v_nov uuid;
  v_dec uuid;
  v_jan uuid := gen_random_uuid();
  v_spread_group uuid := gen_random_uuid();
  v_plain_group uuid := gen_random_uuid();
  v_result jsonb;
  v_account uuid;
  v_count integer;
BEGIN
  INSERT INTO public.asset_category (id, user_id, name)
  VALUES (v_category_id, v_owner_id, 'Comptes');
  INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
  VALUES
    (v_compte_id, v_owner_id, v_category_id, 'Compte courant', 'CHF', 'own'),
    (v_revolut_id, v_owner_id, v_category_id, 'Revolut', 'CHF', 'own');
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_owner_id, 'Modèle', '', false);
  INSERT INTO public.template_line (id, template_id, name, amount, kind, recurrence, description, account_id)
  VALUES
    (v_loyer, v_template_id, 'Loyer', 'c1500', 'expense', 'fixed', '', v_compte_id),
    (v_courses, v_template_id, 'Courses', 'c400', 'expense', 'fixed', '', NULL);

  -- ---------- 1. CA31: a prévision takes the account of its template line ----------
  v_result := public.create_budget_from_template(v_owner_id, v_template_id, 11, 2026, 'Novembre');
  v_nov := (v_result->'budget'->>'id')::uuid;
  v_result := public.create_budget_from_template(v_owner_id, v_template_id, 12, 2026, 'Décembre');
  v_dec := (v_result->'budget'->>'id')::uuid;

  SELECT account_id INTO v_account FROM public.budget_line
  WHERE budget_id = v_nov AND template_line_id = v_loyer;
  IF v_account IS DISTINCT FROM v_compte_id THEN
    RAISE EXCEPTION 'FAIL [1a]: « Loyer » must carry Compte courant, got %', v_account;
  END IF;
  IF (SELECT account_id FROM public.budget_line
      WHERE budget_id = v_nov AND template_line_id = v_courses) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL [1b]: a template line without account gives a prévision without one';
  END IF;
  RAISE NOTICE 'PASS [1] create_budget_from_template copies the account (CA31)';

  -- ---------- 2. CA22: changing the template line account propagates ----------
  -- December's « Loyer » was adjusted by hand: the propagation leaves it alone.
  UPDATE public.budget_line SET is_manually_adjusted = true
  WHERE budget_id = v_dec AND template_line_id = v_loyer;

  PERFORM public.apply_template_line_operations(
    v_template_id,
    ARRAY[v_nov, v_dec],
    ARRAY[]::uuid[],
    jsonb_build_array(
      jsonb_build_object('id', v_loyer, 'account_id', v_revolut_id),
      jsonb_build_object('id', v_courses, 'name', 'Courses Migros')
    ),
    jsonb_build_array(jsonb_build_object(
      'id', v_salaire, 'name', 'Salaire', 'amount', 'c6000', 'kind', 'income',
      'recurrence', 'fixed', 'description', '', 'account_id', v_compte_id))
  );

  IF (SELECT account_id FROM public.template_line WHERE id = v_loyer) IS DISTINCT FROM v_revolut_id THEN
    RAISE EXCEPTION 'FAIL [2a]: the template line must move to Revolut';
  END IF;
  SELECT account_id INTO v_account FROM public.budget_line
  WHERE budget_id = v_nov AND template_line_id = v_loyer;
  IF v_account IS DISTINCT FROM v_revolut_id THEN
    RAISE EXCEPTION 'FAIL [2b]: a prévision not adjusted by hand must follow, got %', v_account;
  END IF;
  SELECT account_id INTO v_account FROM public.budget_line
  WHERE budget_id = v_dec AND template_line_id = v_loyer;
  IF v_account IS DISTINCT FROM v_compte_id THEN
    RAISE EXCEPTION 'FAIL [2c]: a prévision adjusted by hand must keep its account, got %', v_account;
  END IF;
  -- No key: the account stays (here: none stays none).
  IF (SELECT account_id FROM public.template_line WHERE id = v_courses) IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.budget_line
               WHERE template_line_id = v_courses AND account_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL [2d]: an update without the key must not invent an account';
  END IF;
  -- A created line carries its account to the template and to each budget.
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE template_line_id = v_salaire AND account_id = v_compte_id;
  IF (SELECT account_id FROM public.template_line WHERE id = v_salaire) IS DISTINCT FROM v_compte_id
    OR v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL [2e]: a created line must carry its account (% prévisions)', v_count;
  END IF;
  -- An explicit null clears it on the line and the prévisions that follow.
  PERFORM public.apply_template_line_operations(
    v_template_id, ARRAY[v_nov], ARRAY[]::uuid[],
    jsonb_build_array(jsonb_build_object('id', v_loyer, 'account_id', NULL)),
    '[]'::jsonb);
  IF (SELECT account_id FROM public.budget_line
      WHERE budget_id = v_nov AND template_line_id = v_loyer) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL [2f]: an explicit null must clear the propagated account';
  END IF;
  RAISE NOTICE 'PASS [2] apply_template_line_operations writes and propagates the account (CA22)';

  -- ---------- 3. CA23: each occurrence of a spread carries the account ----------
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_jan, v_owner_id, v_template_id, 1, 2027, 'Janvier');
  PERFORM public.create_budget_lines_spread(
    v_spread_group,
    (SELECT jsonb_agg(jsonb_build_object(
       'budget_id', b, 'name', 'Pneus', 'amount', 'c100', 'kind', 'expense',
       'recurrence', 'one_off', 'savings_goal_id', NULL, 'asset_id', NULL,
       'account_id', v_revolut_id, 'original_amount', NULL, 'original_currency', NULL,
       'target_currency', NULL, 'exchange_rate', NULL))
     FROM unnest(ARRAY[v_nov, v_dec, v_jan]) b)
  );
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE spread_group_id = v_spread_group AND account_id = v_revolut_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'FAIL [3a]: 3 occurrences on Revolut expected, got %', v_count;
  END IF;
  -- The payload of a deployed backend has no key: no account.
  PERFORM public.create_budget_lines_spread(
    v_plain_group,
    jsonb_build_array(jsonb_build_object(
      'budget_id', v_jan, 'name', 'Lunettes', 'amount', 'c100', 'kind', 'expense',
      'recurrence', 'one_off'))
  );
  IF EXISTS (SELECT 1 FROM public.budget_line
             WHERE spread_group_id = v_plain_group AND account_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL [3b]: a spread without the key must have no account';
  END IF;
  RAISE NOTICE 'PASS [3] create_budget_lines_spread carries the account (CA23)';

  -- ---------- 4. create_template_with_lines writes and returns it ----------
  v_result := public.create_template_with_lines(
    v_owner_id, 'Mois été', NULL, false,
    jsonb_build_array(jsonb_build_object(
      'name', 'Loyer', 'amount', 'c1500', 'kind', 'expense', 'recurrence', 'fixed',
      'description', '', 'account_id', v_compte_id, 'tag_ids', '[]'::jsonb))
  )::jsonb;
  IF (v_result->'template_lines'->0->>'account_id')::uuid IS DISTINCT FROM v_compte_id
    OR NOT EXISTS (SELECT 1 FROM public.template_line
                   WHERE template_id = (v_result->>'id')::uuid AND account_id = v_compte_id) THEN
    RAISE EXCEPTION 'FAIL [4]: create_template_with_lines must write and return the account: %', v_result;
  END IF;
  RAISE NOTICE 'PASS [4] create_template_with_lines writes and returns the account';

  -- ---------- 5. update_template_line_with_tags ----------
  PERFORM public.update_template_line_with_tags(
    v_salaire, jsonb_build_object('name', 'Salaire net'), ARRAY[]::uuid[]);
  IF (SELECT account_id FROM public.template_line WHERE id = v_salaire) IS DISTINCT FROM v_compte_id THEN
    RAISE EXCEPTION 'FAIL [5a]: an absent key must keep the template line account';
  END IF;
  PERFORM public.update_template_line_with_tags(
    v_salaire, jsonb_build_object('account_id', v_revolut_id), ARRAY[]::uuid[]);
  IF (SELECT account_id FROM public.template_line WHERE id = v_salaire) IS DISTINCT FROM v_revolut_id THEN
    RAISE EXCEPTION 'FAIL [5b]: the template line account must move to Revolut';
  END IF;
  RAISE NOTICE 'PASS [5] update_template_line_with_tags keeps and writes the account';

  RAISE NOTICE 'PREVISION ACCOUNT COPIES: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
