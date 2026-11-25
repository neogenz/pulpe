-- The account of a movement (PUL-378): the guard on the three tables, the CHECK
-- against the same asset in `account_id` and `asset_id`, ON DELETE SET NULL,
-- freed movements taking the account of their deleted prévision, the read
-- behind the value of an asset, and a user deletion cascading through it all.
BEGIN;

-- Runs one statement as the current role and checks the exact refusal message.
CREATE FUNCTION public.test_expect_refusal(p_sql text, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    v_message := SQLERRM;
  END;
  IF v_message IS NULL THEN
    RAISE EXCEPTION 'FAIL: expected "%" but the statement succeeded: %', p_message, p_sql;
  END IF;
  IF v_message <> p_message THEN
    RAISE EXCEPTION 'FAIL: expected "%" but got "%": %', p_message, v_message, p_sql;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.test_expect_refusal(text, text) TO authenticated;

SELECT set_config('test.owner_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_asset_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES
  (current_setting('test.owner_id')::uuid, 'account-link-owner@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  (current_setting('test.other_id')::uuid, 'account-link-other@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- Another user's account, with a checked movement on it: never the owner's.
DO $$
DECLARE
  v_other_id uuid := current_setting('test.other_id')::uuid;
  v_other_asset_id uuid := current_setting('test.other_asset_id')::uuid;
  v_category_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.asset_category (id, user_id, name)
  VALUES (v_category_id, v_other_id, 'Comptes');
  INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
  VALUES (v_other_asset_id, v_other_id, v_category_id, 'Compte', 'CHF', 'own');
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_other_id, 'Other', '', false);
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_budget_id, v_other_id, v_template_id, 11, 2026, 'Other');
  INSERT INTO public.transaction (budget_id, name, amount, kind, checked_at, account_id)
  VALUES (v_budget_id, 'Other', 'c', 'expense', '2026-11-05 10:00+00', v_other_asset_id);
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.owner_id'))::text,
  true
);

DO $$
DECLARE
  v_owner_id uuid := current_setting('test.owner_id')::uuid;
  v_other_asset_id uuid := current_setting('test.other_asset_id')::uuid;
  v_since timestamptz := '2026-11-03 10:00+00';
  v_before timestamptz := '2026-11-02 10:00+00';
  v_after timestamptz := '2026-11-05 10:00+00';
  v_category_id uuid := gen_random_uuid();
  v_compte_id uuid := gen_random_uuid();   -- Compte courant, own
  v_revolut_id uuid := gen_random_uuid();  -- own
  v_livret_id uuid := gen_random_uuid();   -- own
  v_leasing_id uuid := gen_random_uuid();  -- owe
  v_template_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_line_after uuid := gen_random_uuid();
  v_line_real_after uuid := gen_random_uuid();
  v_line_asset_after uuid := gen_random_uuid();
  v_line_before uuid := gen_random_uuid();
  v_line_unlinked uuid := gen_random_uuid();
  v_real_before uuid := gen_random_uuid();
  v_real_after uuid := gen_random_uuid();
  v_real_unchecked uuid := gen_random_uuid();
  v_real_of_line_before uuid := gen_random_uuid();
  v_free_after uuid := gen_random_uuid();
  v_free_before uuid := gen_random_uuid();
  v_free_unchecked uuid := gen_random_uuid();
  v_free_without_account uuid := gen_random_uuid();
  v_courses uuid := gen_random_uuid();
  v_courses_real_1 uuid := gen_random_uuid();
  v_courses_real_2 uuid := gen_random_uuid();
  v_plain_line uuid := gen_random_uuid();
  v_plain_real uuid := gen_random_uuid();
  v_template_line uuid := gen_random_uuid();
  v_listed text[];
  v_count integer;
BEGIN
  INSERT INTO public.asset_category (id, user_id, name)
  VALUES (v_category_id, v_owner_id, 'Comptes');
  INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
  VALUES
    (v_compte_id, v_owner_id, v_category_id, 'Compte courant', 'CHF', 'own'),
    (v_revolut_id, v_owner_id, v_category_id, 'Revolut', 'CHF', 'own'),
    (v_livret_id, v_owner_id, v_category_id, 'Livret', 'CHF', 'own'),
    (v_leasing_id, v_owner_id, v_category_id, 'Leasing', 'CHF', 'owe');
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_owner_id, 'Modèle', '', false);
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_budget_id, v_owner_id, v_template_id, 11, 2026, 'Novembre');

  -- ---------- 1. Guard: any kind, either direction, the owner's only ----------
  INSERT INTO public.template_line (id, template_id, name, amount, kind, recurrence, account_id)
  VALUES
    (v_template_line, v_template_id, 'Loyer', 'c', 'expense', 'fixed', v_compte_id),
    (gen_random_uuid(), v_template_id, 'Salaire', 'c', 'income', 'fixed', v_leasing_id);
  INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, account_id)
  VALUES (v_budget_id, 'Salaire', 'c', 'income', 'fixed', v_leasing_id);
  INSERT INTO public.transaction (budget_id, name, amount, kind, account_id)
  VALUES (v_budget_id, 'Achat carte', 'c', 'expense', v_leasing_id);

  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, account_id)
       VALUES (%L, 'x', 'c', 'expense', 'one_off', %L)$f$,
    v_budget_id, v_other_asset_id), 'Account access denied');
  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, account_id)
       VALUES (%L, 'x', 'c', 'expense', 'fixed', %L)$f$,
    v_template_id, v_other_asset_id), 'Account access denied');
  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.transaction (budget_id, name, amount, kind, account_id)
       VALUES (%L, 'x', 'c', 'expense', %L)$f$,
    v_budget_id, v_other_asset_id), 'Account access denied');
  -- A deleted (unknown) account, and an UPDATE onto a foreign one.
  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.transaction (budget_id, name, amount, kind, account_id)
       VALUES (%L, 'x', 'c', 'expense', %L)$f$,
    v_budget_id, gen_random_uuid()), 'Account access denied');
  PERFORM public.test_expect_refusal(format(
    $f$UPDATE public.template_line SET account_id = %L WHERE id = %L$f$,
    v_other_asset_id, v_template_line), 'Account access denied');

  -- ---------- 2. CA25: the same asset as account and as « Versée sur » ----------
  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, account_id, asset_id)
       VALUES (%L, 'x', 'c', 'saving', 'one_off', %L, %L)$f$,
    v_budget_id, v_livret_id, v_livret_id),
    'new row for relation "budget_line" violates check constraint "budget_line_account_not_asset"');
  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, account_id, asset_id)
       VALUES (%L, 'x', 'c', 'saving', 'fixed', %L, %L)$f$,
    v_template_id, v_livret_id, v_livret_id),
    'new row for relation "template_line" violates check constraint "template_line_account_not_asset"');
  -- Two different assets are fine (CA7).
  INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, account_id, asset_id)
  VALUES (v_budget_id, 'Épargne mensuelle', 'c', 'saving', 'fixed', v_compte_id, v_livret_id);

  -- ---------- 3. list_asset_movements ----------
  INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence, checked_at, account_id, asset_id)
  VALUES
    (v_line_after, v_budget_id, 'Checked after', 'c', 'expense', 'one_off', v_after, v_compte_id, NULL),
    (v_line_real_after, v_budget_id, 'Movement after', 'c', 'expense', 'one_off', NULL, v_compte_id, NULL),
    (v_line_asset_after, v_budget_id, 'Versée sur', 'c', 'saving', 'one_off', v_after, NULL, v_livret_id),
    (v_line_before, v_budget_id, 'All before', 'c', 'saving', 'one_off', v_before, NULL, v_livret_id),
    (v_line_unlinked, v_budget_id, 'Unlinked', 'c', 'expense', 'one_off', v_after, NULL, NULL);
  INSERT INTO public.transaction (id, budget_id, budget_line_id, name, amount, kind, checked_at, account_id)
  VALUES
    (v_real_before, v_budget_id, v_line_real_after, 'r', 'c', 'expense', v_before, NULL),
    (v_real_after, v_budget_id, v_line_real_after, 'r', 'c', 'expense', v_after, NULL),
    (v_real_unchecked, v_budget_id, v_line_real_after, 'r', 'c', 'expense', NULL, NULL),
    (v_real_of_line_before, v_budget_id, v_line_before, 'r', 'c', 'saving', v_before, NULL),
    (v_free_after, v_budget_id, NULL, 'f', 'c', 'expense', v_after, v_compte_id),
    (v_free_before, v_budget_id, NULL, 'f', 'c', 'expense', v_before, v_compte_id),
    (v_free_unchecked, v_budget_id, NULL, 'f', 'c', 'expense', NULL, v_compte_id),
    (v_free_without_account, v_budget_id, NULL, 'f', 'c', 'expense', v_after, NULL);

  SELECT array_agg(m.movement || ':' || m.id ORDER BY m.movement, m.id)
  INTO v_listed
  FROM public.list_asset_movements(v_since) m;

  IF v_listed IS DISTINCT FROM (
    SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[
      'line:' || v_line_after,
      'line:' || v_line_real_after,
      'line:' || v_line_asset_after,
      'real:' || v_real_before,
      'real:' || v_real_after,
      'free:' || v_free_after
    ]) x
  ) THEN
    RAISE EXCEPTION 'FAIL: list_asset_movements returned %', v_listed;
  END IF;

  -- Each row carries what the formula reads.
  IF NOT EXISTS (
    SELECT 1 FROM public.list_asset_movements(v_since) m
    WHERE m.id = v_real_before AND m.budget_line_id = v_line_real_after
      AND m.checked_at = v_before AND m.amount = 'c'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.list_asset_movements(v_since) m
    WHERE m.id = v_line_asset_after AND m.asset_id = v_livret_id
      AND m.account_id IS NULL AND m.kind = 'saving'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.list_asset_movements(v_since) m
    WHERE m.id = v_free_after AND m.account_id = v_compte_id
  ) THEN
    RAISE EXCEPTION 'FAIL: list_asset_movements lost a column';
  END IF;

  -- ---------- 4. CA46: freed movements take the account, in the same statement ----------
  INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence, checked_at, account_id)
  VALUES
    (v_courses, v_budget_id, 'Courses', 'c', 'expense', 'one_off', v_after, v_revolut_id),
    (v_plain_line, v_budget_id, 'Sans compte', 'c', 'expense', 'one_off', v_after, NULL);
  INSERT INTO public.transaction (id, budget_id, budget_line_id, name, amount, kind, checked_at)
  VALUES
    (v_courses_real_1, v_budget_id, v_courses, 'Migros', 'c', 'expense', v_after),
    (v_courses_real_2, v_budget_id, v_courses, 'Coop', 'c', 'expense', NULL),
    (v_plain_real, v_budget_id, v_plain_line, 'x', 'c', 'expense', v_after);

  DELETE FROM public.budget_line WHERE id IN (v_courses, v_plain_line);

  SELECT count(*) INTO v_count
  FROM public.transaction
  WHERE id IN (v_courses_real_1, v_courses_real_2)
    AND budget_line_id IS NULL
    AND account_id = v_revolut_id;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: CA46 freed movements must keep Revolut, % did', v_count;
  END IF;
  IF (SELECT account_id FROM public.transaction WHERE id = v_plain_real) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a prévision without account must leave its movements without one';
  END IF;
  -- The checked one is now a free movement on Revolut.
  IF NOT EXISTS (
    SELECT 1 FROM public.list_asset_movements(v_since) m
    WHERE m.movement = 'free' AND m.id = v_courses_real_1 AND m.account_id = v_revolut_id
  ) THEN
    RAISE EXCEPTION 'FAIL: CA46 freed movement must be read as a free movement';
  END IF;

  -- ---------- 5. CA24: archive keeps the link, delete clears it ----------
  UPDATE public.asset SET archived_at = now() WHERE id = v_revolut_id;
  -- An archived account is still accepted on an edit that keeps or sets it.
  UPDATE public.transaction SET account_id = v_revolut_id WHERE id = v_plain_real;
  IF (SELECT count(*) FROM public.transaction WHERE account_id = v_revolut_id) <> 3 THEN
    RAISE EXCEPTION 'FAIL: archiving must keep the links';
  END IF;

  UPDATE public.template_line SET account_id = v_revolut_id WHERE id = v_template_line;
  UPDATE public.budget_line SET account_id = v_revolut_id WHERE id = v_line_after;
  DELETE FROM public.asset WHERE id = v_revolut_id;

  IF EXISTS (SELECT 1 FROM public.transaction WHERE id IN (v_courses_real_1, v_courses_real_2, v_plain_real) AND account_id IS NOT NULL)
    OR (SELECT count(*) FROM public.transaction WHERE id IN (v_courses_real_1, v_courses_real_2, v_plain_real)) <> 3
  THEN
    RAISE EXCEPTION 'FAIL: deleting the account must keep the movements and clear their account';
  END IF;
  IF (SELECT account_id FROM public.budget_line WHERE id = v_line_after) IS NOT NULL
    OR (SELECT account_id FROM public.template_line WHERE id = v_template_line) IS NOT NULL
  THEN
    RAISE EXCEPTION 'FAIL: deleting the account must clear the prévision and the template line';
  END IF;

  RAISE NOTICE 'MOVEMENT ACCOUNT LINK: OWNER ASSERTIONS PASSED';
END $$;

RESET ROLE;

DO $$
DECLARE
  v_owner_id uuid := current_setting('test.owner_id')::uuid;
  v_definition text;
BEGIN
  -- The guard is a hardened definer no API role can call; the read is invoker
  -- rights with an empty search_path, closed to anon.
  SELECT pg_get_functiondef(p.oid) INTO v_definition
  FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.enforce_account_link()')
    AND p.prosecdef
    AND 'search_path=""' = ANY(p.proconfig);
  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'FAIL: enforce_account_link must be a hardened SECURITY DEFINER';
  END IF;
  IF has_function_privilege('authenticated', 'public.enforce_account_link()', 'EXECUTE')
    OR has_function_privilege('anon', 'public.enforce_account_link()', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FAIL: the guard function must not be executable by API roles';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.list_asset_movements(timestamptz)')
      AND NOT p.prosecdef
      AND 'search_path=""' = ANY(p.proconfig)
  ) THEN
    RAISE EXCEPTION 'FAIL: list_asset_movements must stay SECURITY INVOKER with an empty search_path';
  END IF;
  IF has_function_privilege('anon', 'public.list_asset_movements(timestamptz)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.list_asset_movements(timestamptz)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FAIL: list_asset_movements must be callable by authenticated only';
  END IF;

  -- A user deletion cascades through prévisions with an account and their
  -- movements without tripping the guard or the delete trigger.
  IF NOT EXISTS (
    SELECT 1 FROM public.budget_line bl
    JOIN public.monthly_budget mb ON mb.id = bl.budget_id
    WHERE mb.user_id = v_owner_id AND bl.account_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.transaction t WHERE t.budget_line_id = bl.id)
  ) THEN
    RAISE EXCEPTION 'FAIL: the cascade check needs a prévision with an account and movements';
  END IF;
  DELETE FROM auth.users WHERE id = v_owner_id;
  IF EXISTS (SELECT 1 FROM public.monthly_budget WHERE user_id = v_owner_id)
    OR EXISTS (SELECT 1 FROM public.asset WHERE user_id = v_owner_id)
  THEN
    RAISE EXCEPTION 'FAIL: user deletion must empty the budgets and the assets';
  END IF;

  RAISE NOTICE 'MOVEMENT ACCOUNT LINK: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
