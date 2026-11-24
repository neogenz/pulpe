-- The read behind the value and the history of an asset (PUL-379):
-- `list_asset_movements_for` filtered by asset returns only what can move that
-- asset, with the movement's name; without an asset it returns the same rows
-- as `list_asset_movements`; another user's asset returns nothing; anon cannot
-- execute it.
BEGIN;

SELECT set_config('test.owner_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_asset_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES
  (current_setting('test.owner_id')::uuid, 'asset-history-owner@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  (current_setting('test.other_id')::uuid, 'asset-history-other@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- Another user's account, with a checked movement on it.
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
  v_since timestamptz := '2026-11-01 00:00+00';
  v_before timestamptz := '2026-10-28 10:00+00';
  v_after timestamptz := '2026-11-05 10:00+00';
  v_category_id uuid := gen_random_uuid();
  v_compte_id uuid := gen_random_uuid();  -- Compte courant, own
  v_livret_id uuid := gen_random_uuid();  -- own
  v_revolut_id uuid := gen_random_uuid(); -- own
  v_template_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_loyer uuid := gen_random_uuid();      -- account Compte courant
  v_epargne uuid := gen_random_uuid();    -- account Compte courant, « Versée sur » Livret
  v_courses uuid := gen_random_uuid();    -- account Revolut
  v_courses_real uuid := gen_random_uuid();
  v_loyer_real uuid := gen_random_uuid();
  v_restaurant uuid := gen_random_uuid(); -- free, Compte courant
  v_cafe uuid := gen_random_uuid();       -- free, Revolut
  v_listed text[];
BEGIN
  INSERT INTO public.asset_category (id, user_id, name)
  VALUES (v_category_id, v_owner_id, 'Comptes');
  INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
  VALUES
    (v_compte_id, v_owner_id, v_category_id, 'Compte courant', 'CHF', 'own'),
    (v_livret_id, v_owner_id, v_category_id, 'Livret', 'CHF', 'own'),
    (v_revolut_id, v_owner_id, v_category_id, 'Revolut', 'CHF', 'own');
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_owner_id, 'Modèle', '', false);
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_budget_id, v_owner_id, v_template_id, 11, 2026, 'Novembre');

  INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence, checked_at, account_id, asset_id)
  VALUES
    (v_loyer, v_budget_id, 'Loyer', 'c', 'expense', 'fixed', v_after, v_compte_id, NULL),
    (v_epargne, v_budget_id, 'Épargne', 'c', 'saving', 'fixed', v_after, v_compte_id, v_livret_id),
    (v_courses, v_budget_id, 'Courses', 'c', 'expense', 'one_off', NULL, v_revolut_id, NULL);
  INSERT INTO public.transaction (id, budget_id, budget_line_id, name, amount, kind, checked_at, account_id)
  VALUES
    (v_loyer_real, v_budget_id, v_loyer, 'Virement loyer', 'c', 'expense', v_before, NULL),
    (v_courses_real, v_budget_id, v_courses, 'Migros', 'c', 'expense', v_after, NULL),
    (v_restaurant, v_budget_id, NULL, 'Restaurant', 'c', 'expense', v_after, v_compte_id),
    (v_cafe, v_budget_id, NULL, 'Café', 'c', 'expense', v_after, v_revolut_id);

  -- The Livret: only the prévision « Versée sur » it, with its name.
  SELECT array_agg(m.movement || ':' || m.id || ':' || m.name ORDER BY m.movement, m.id)
  INTO v_listed
  FROM public.list_asset_movements_for(v_since, v_livret_id) m;
  IF v_listed IS DISTINCT FROM ARRAY['line:' || v_epargne || ':Épargne'] THEN
    RAISE EXCEPTION 'FAIL: Livret filter returned %', v_listed;
  END IF;

  -- The Compte courant: its two prévisions, their checked movements (before
  -- the instant included) and its free movement, each with its name.
  SELECT array_agg(m.movement || ':' || m.id || ':' || m.name ORDER BY m.movement, m.id)
  INTO v_listed
  FROM public.list_asset_movements_for(v_since, v_compte_id) m;
  IF v_listed IS DISTINCT FROM (
    SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[
      'free:' || v_restaurant || ':Restaurant',
      'line:' || v_epargne || ':Épargne',
      'line:' || v_loyer || ':Loyer',
      'real:' || v_loyer_real || ':Virement loyer'
    ]) x
  ) THEN
    RAISE EXCEPTION 'FAIL: Compte courant filter returned %', v_listed;
  END IF;

  -- Revolut: the prévision moved by its movement, and the free one.
  SELECT array_agg(m.movement || ':' || m.id ORDER BY m.movement, m.id)
  INTO v_listed
  FROM public.list_asset_movements_for(v_since, v_revolut_id) m;
  IF v_listed IS DISTINCT FROM (
    SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[
      'free:' || v_cafe,
      'line:' || v_courses,
      'real:' || v_courses_real
    ]) x
  ) THEN
    RAISE EXCEPTION 'FAIL: Revolut filter returned %', v_listed;
  END IF;

  -- Without an asset: exactly the rows of `list_asset_movements`, both ways.
  IF EXISTS (
    SELECT movement, id, budget_line_id, kind, amount, checked_at, account_id, asset_id
    FROM public.list_asset_movements_for(v_since)
    EXCEPT ALL
    SELECT movement, id, budget_line_id, kind, amount, checked_at, account_id, asset_id
    FROM public.list_asset_movements(v_since)
  ) OR EXISTS (
    SELECT movement, id, budget_line_id, kind, amount, checked_at, account_id, asset_id
    FROM public.list_asset_movements(v_since)
    EXCEPT ALL
    SELECT movement, id, budget_line_id, kind, amount, checked_at, account_id, asset_id
    FROM public.list_asset_movements_for(v_since)
  ) THEN
    RAISE EXCEPTION 'FAIL: without an asset, the rows must equal list_asset_movements';
  END IF;
  IF (SELECT count(*) FROM public.list_asset_movements_for(v_since, NULL)) <> 7 THEN
    RAISE EXCEPTION 'FAIL: without an asset, every movement of the caller must be read';
  END IF;

  -- Another user's asset: nothing, even with its id.
  IF EXISTS (SELECT 1 FROM public.list_asset_movements_for(v_since, v_other_asset_id)) THEN
    RAISE EXCEPTION 'FAIL: another user''s asset must return nothing';
  END IF;

  RAISE NOTICE 'ASSET HISTORY MOVEMENTS: OWNER ASSERTIONS PASSED';
END $$;

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.list_asset_movements_for(timestamptz,uuid)')
      AND NOT p.prosecdef
      AND 'search_path=""' = ANY(p.proconfig)
  ) THEN
    RAISE EXCEPTION 'FAIL: list_asset_movements_for must be SECURITY INVOKER with an empty search_path';
  END IF;
  IF has_function_privilege('anon', 'public.list_asset_movements_for(timestamptz,uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.list_asset_movements_for(timestamptz,uuid)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FAIL: list_asset_movements_for must be callable by authenticated only';
  END IF;

  RAISE NOTICE 'ASSET HISTORY MOVEMENTS: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
