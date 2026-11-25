-- The default account (PUL-378): owner-only RLS, the composite foreign key
-- that keeps another user's asset out, choosing or changing it writing no
-- movement, deleting or archiving the asset clearing it, unarchiving not
-- bringing it back.
BEGIN;

SELECT set_config('test.owner_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_asset_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES
  (current_setting('test.owner_id')::uuid, 'default-account-owner@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  (current_setting('test.other_id')::uuid, 'default-account-other@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- Another user, with an asset set as their own default account.
DO $$
DECLARE
  v_other_id uuid := current_setting('test.other_id')::uuid;
  v_category_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.asset_category (id, user_id, name)
  VALUES (v_category_id, v_other_id, 'Comptes');
  INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
  VALUES (current_setting('test.other_asset_id')::uuid, v_other_id, v_category_id,
          'Compte', 'CHF', 'own');
  INSERT INTO public.user_default_account (user_id, asset_id)
  VALUES (v_other_id, current_setting('test.other_asset_id')::uuid);
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
  v_other_id uuid := current_setting('test.other_id')::uuid;
  v_other_asset_id uuid := current_setting('test.other_asset_id')::uuid;
  v_category_id uuid := gen_random_uuid();
  v_compte_id uuid := gen_random_uuid();   -- Compte courant, 5 000
  v_revolut_id uuid := gen_random_uuid();  -- Revolut, 400
  v_livret_id uuid := gen_random_uuid();   -- Livret, 10 000
  v_leasing_id uuid := gen_random_uuid();  -- Leasing, 8 000, owe
  v_template_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_count integer;
  v_blocked boolean;
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
  INSERT INTO public.template_line (template_id, name, amount, kind, recurrence)
  VALUES (v_template_id, 'Loyer', 'c', 'expense', 'fixed');
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_budget_id, v_owner_id, v_template_id, 11, 2026, 'Novembre');
  INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, checked_at)
  VALUES (v_budget_id, 'Loyer', 'c', 'expense', 'fixed', now());
  INSERT INTO public.transaction (budget_id, name, amount, kind, checked_at, account_id)
  VALUES
    (v_budget_id, 'Restaurant', 'c', 'expense', now(), NULL),
    (v_budget_id, 'Courses', 'c', 'expense', NULL, v_compte_id);

  -- ---------- RLS: the other user's row stays hidden and untouched ----------
  SELECT count(*) INTO v_count FROM public.user_default_account;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: another user''s default account must be hidden';
  END IF;
  UPDATE public.user_default_account SET asset_id = v_compte_id
  WHERE user_id = v_other_id;
  DELETE FROM public.user_default_account WHERE user_id = v_other_id;
  IF FOUND THEN
    RAISE EXCEPTION 'FAIL: another user''s default account must not be deleted';
  END IF;
  v_blocked := false;
  BEGIN
    INSERT INTO public.user_default_account (user_id, asset_id)
    VALUES (v_other_id, v_other_asset_id);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: writing a default account for another user must be refused';
  END IF;

  -- ---------- Composite foreign key: another user's asset refused ----------
  v_blocked := false;
  BEGIN
    INSERT INTO public.user_default_account (user_id, asset_id)
    VALUES (v_owner_id, v_other_asset_id);
  EXCEPTION WHEN foreign_key_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: another user''s asset must be refused as default account';
  END IF;

  -- ---------- CA28, CA30: choosing Compte courant writes no movement ----------
  INSERT INTO public.user_default_account (user_id, asset_id)
  VALUES (v_owner_id, v_compte_id);
  SELECT count(*) INTO v_count FROM public.user_default_account;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: the owner must read their own default account';
  END IF;
  IF EXISTS (SELECT 1 FROM public.budget_line WHERE budget_id = v_budget_id AND account_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.template_line WHERE template_id = v_template_id AND account_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.transaction WHERE name = 'Restaurant' AND budget_id = v_budget_id AND account_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'FAIL: CA30 choosing a default account must not attach existing movements';
  END IF;

  -- ---------- CA33: switching to Revolut keeps Courses on Compte courant ----------
  UPDATE public.user_default_account SET asset_id = v_revolut_id
  WHERE user_id = v_owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: the owner must change their default account';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.transaction WHERE name = 'Courses' AND account_id = v_compte_id) THEN
    RAISE EXCEPTION 'FAIL: CA33 a movement on Compte courant must keep it';
  END IF;
  v_blocked := false;
  BEGIN
    UPDATE public.user_default_account SET asset_id = v_other_asset_id
    WHERE user_id = v_owner_id;
  EXCEPTION WHEN foreign_key_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: switching onto another user''s asset must be refused';
  END IF;

  -- ---------- CA35: archiving clears it; unarchiving does not bring it back ----------
  UPDATE public.asset SET archived_at = now() WHERE id = v_livret_id;
  IF NOT EXISTS (SELECT 1 FROM public.user_default_account WHERE asset_id = v_revolut_id) THEN
    RAISE EXCEPTION 'FAIL: archiving another asset must keep the default account';
  END IF;
  UPDATE public.asset SET archived_at = now() WHERE id = v_revolut_id;
  IF EXISTS (SELECT 1 FROM public.user_default_account) THEN
    RAISE EXCEPTION 'FAIL: CA35 archiving the default account must clear the setting';
  END IF;
  UPDATE public.asset SET archived_at = NULL WHERE id = v_revolut_id;
  IF EXISTS (SELECT 1 FROM public.user_default_account) THEN
    RAISE EXCEPTION 'FAIL: CA35 unarchiving must not restore the default account';
  END IF;

  -- ---------- CA35: deleting it clears the setting ----------
  INSERT INTO public.user_default_account (user_id, asset_id)
  VALUES (v_owner_id, v_leasing_id);
  DELETE FROM public.asset WHERE id = v_leasing_id;
  IF EXISTS (SELECT 1 FROM public.user_default_account) THEN
    RAISE EXCEPTION 'FAIL: CA35 deleting the default account must clear the setting';
  END IF;

  -- ---------- CA34: removing it changes no movement ----------
  INSERT INTO public.user_default_account (user_id, asset_id)
  VALUES (v_owner_id, v_compte_id);
  DELETE FROM public.user_default_account WHERE user_id = v_owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: the owner must remove their default account';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.transaction WHERE name = 'Courses' AND account_id = v_compte_id) THEN
    RAISE EXCEPTION 'FAIL: CA34 removing the default must keep existing accounts';
  END IF;
END $$;

RESET ROLE;

DO $$
DECLARE
  v_other_id uuid := current_setting('test.other_id')::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_default_account WHERE user_id = v_other_id) THEN
    RAISE EXCEPTION 'FAIL: the other user''s default account must be untouched';
  END IF;
  IF has_table_privilege('anon', 'public.user_default_account', 'SELECT')
    OR has_table_privilege('anon', 'public.user_default_account', 'INSERT')
  THEN
    RAISE EXCEPTION 'FAIL: anon must have no privilege on user_default_account';
  END IF;
  IF has_function_privilege('authenticated', 'public.clear_default_account_on_archive()', 'EXECUTE')
    OR has_function_privilege('anon', 'public.clear_default_account_on_archive()', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FAIL: the archive trigger function must be closed to API roles';
  END IF;

  -- A user deletion cascades through the setting.
  DELETE FROM auth.users WHERE id = v_other_id;
  IF EXISTS (SELECT 1 FROM public.user_default_account WHERE user_id = v_other_id) THEN
    RAISE EXCEPTION 'FAIL: user deletion must remove the default account';
  END IF;

  RAISE NOTICE 'USER DEFAULT ACCOUNT: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
