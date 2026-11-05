-- Net worth tables: owner-only RLS, tenant integrity through composite foreign
-- keys, RESTRICT on a non-empty category, and cascade when the user is deleted.
BEGIN;

SELECT set_config('test.owner_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_category_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_asset_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES
  (current_setting('test.owner_id')::uuid, 'asset-owner@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  (current_setting('test.other_id')::uuid, 'asset-other@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.asset_category (id, user_id, name)
VALUES (
  current_setting('test.other_category_id')::uuid,
  current_setting('test.other_id')::uuid,
  'Immobilier'
);
INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
VALUES (
  current_setting('test.other_asset_id')::uuid,
  current_setting('test.other_id')::uuid,
  current_setting('test.other_category_id')::uuid,
  'Appartement', 'CHF', 'own'
);
INSERT INTO public.asset_snapshot (user_id, asset_id, value)
VALUES (
  current_setting('test.other_id')::uuid,
  current_setting('test.other_asset_id')::uuid,
  'other-ciphertext'
);

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
  v_other_category_id uuid := current_setting('test.other_category_id')::uuid;
  v_other_asset_id uuid := current_setting('test.other_asset_id')::uuid;
  v_category_id uuid := gen_random_uuid();
  v_asset_id uuid := gen_random_uuid();
  v_count integer;
BEGIN
  -- The owner writes and reads their own rows, and sees none of the other's.
  INSERT INTO public.asset_category (id, user_id, name)
  VALUES (v_category_id, v_owner_id, 'Épargne');
  INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
  VALUES (v_asset_id, v_owner_id, v_category_id, 'Compte', 'EUR', 'own');
  INSERT INTO public.asset_snapshot (user_id, asset_id, value)
  VALUES (v_owner_id, v_asset_id, 'owner-ciphertext');

  SELECT count(*) INTO v_count FROM public.asset_category;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: owner must see exactly their own category, saw %', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.asset;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: owner must see exactly their own asset, saw %', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.asset_snapshot;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: owner must see exactly their own snapshot, saw %', v_count;
  END IF;

  -- Foreign rows are invisible to UPDATE and DELETE.
  UPDATE public.asset_category SET name = 'Pirate' WHERE id = v_other_category_id;
  IF FOUND THEN RAISE EXCEPTION 'FAIL: foreign category update must be hidden by RLS'; END IF;
  UPDATE public.asset SET name = 'Pirate' WHERE id = v_other_asset_id;
  IF FOUND THEN RAISE EXCEPTION 'FAIL: foreign asset update must be hidden by RLS'; END IF;
  DELETE FROM public.asset_snapshot WHERE asset_id = v_other_asset_id;
  IF FOUND THEN RAISE EXCEPTION 'FAIL: foreign snapshot delete must be hidden by RLS'; END IF;

  -- A row stamped with another user's id is refused by RLS.
  BEGIN
    INSERT INTO public.asset_category (user_id, name) VALUES (v_other_id, 'Intrus');
    RAISE EXCEPTION 'FAIL: foreign category insert must be rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.asset (user_id, category_id, name, currency, direction)
    VALUES (v_other_id, v_other_category_id, 'Intrus', 'CHF', 'own');
    RAISE EXCEPTION 'FAIL: foreign asset insert must be rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.asset_snapshot (user_id, asset_id, value)
    VALUES (v_other_id, v_other_asset_id, 'intrus');
    RAISE EXCEPTION 'FAIL: foreign snapshot insert must be rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Own user_id but another user's category or asset: the composite FK refuses.
  BEGIN
    INSERT INTO public.asset (user_id, category_id, name, currency, direction)
    VALUES (v_owner_id, v_other_category_id, 'Pont', 'CHF', 'own');
    RAISE EXCEPTION 'FAIL: asset in a foreign category must be rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.asset_snapshot (user_id, asset_id, value)
    VALUES (v_owner_id, v_other_asset_id, 'pont');
    RAISE EXCEPTION 'FAIL: snapshot on a foreign asset must be rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- Value constraints.
  BEGIN
    INSERT INTO public.asset (user_id, category_id, name, currency, direction)
    VALUES (v_owner_id, v_category_id, 'Dollars', 'USD', 'own');
    RAISE EXCEPTION 'FAIL: unsupported currency must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.asset (user_id, category_id, name, currency, direction)
    VALUES (v_owner_id, v_category_id, 'Prêt', 'CHF', 'debt');
    RAISE EXCEPTION 'FAIL: unsupported direction must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.asset_category (user_id, name) VALUES (v_owner_id, 'ÉPARGNE');
    RAISE EXCEPTION 'FAIL: case-insensitive duplicate category must be rejected';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- A category that still holds an asset cannot be deleted.
  BEGIN
    DELETE FROM public.asset_category WHERE id = v_category_id;
    RAISE EXCEPTION 'FAIL: deleting a non-empty category must be refused';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- Direction and currency are fixed at creation; the editable columns stay
  -- writable.
  BEGIN
    UPDATE public.asset SET direction = 'owe' WHERE id = v_asset_id;
    RAISE EXCEPTION 'FAIL: changing the direction must be refused';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.asset SET currency = 'CHF' WHERE id = v_asset_id;
    RAISE EXCEPTION 'FAIL: changing the currency must be refused';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.asset
  SET name = 'Compte joint', in_pulpe = true, archived_at = now(),
      suggestion_dismissed_at = now(), category_id = v_category_id
  WHERE id = v_asset_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: editable asset columns must stay writable'; END IF;

  -- A snapshot is written once: only the rekey (SECURITY DEFINER) rewrites it.
  IF has_table_privilege('authenticated', 'public.asset_snapshot', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: snapshots must not be updatable by the user';
  END IF;

  -- anon holds no privilege at all.
  IF has_table_privilege('anon', 'public.asset', 'SELECT')
    OR has_table_privilege('anon', 'public.asset_category', 'SELECT')
    OR has_table_privilege('anon', 'public.asset_snapshot', 'SELECT')
  THEN
    RAISE EXCEPTION 'FAIL: anon must not read the net worth tables';
  END IF;

  RAISE NOTICE 'ASSET TABLES RLS AND FK: ALL ASSERTIONS PASSED';
END $$;

RESET ROLE;

-- Deleting the user empties the three tables, even though the category is
-- RESTRICTed while an asset still points at it.
DO $$
DECLARE
  v_owner_id uuid := current_setting('test.owner_id')::uuid;
  v_other_id uuid := current_setting('test.other_id')::uuid;
BEGIN
  DELETE FROM auth.users WHERE id = v_owner_id;
  IF EXISTS (SELECT 1 FROM public.asset_category WHERE user_id = v_owner_id)
    OR EXISTS (SELECT 1 FROM public.asset WHERE user_id = v_owner_id)
    OR EXISTS (SELECT 1 FROM public.asset_snapshot WHERE user_id = v_owner_id)
  THEN
    RAISE EXCEPTION 'FAIL: user deletion must empty the three tables';
  END IF;

  DELETE FROM auth.users WHERE id = v_other_id;
  IF EXISTS (SELECT 1 FROM public.asset_category WHERE user_id = v_other_id)
    OR EXISTS (SELECT 1 FROM public.asset WHERE user_id = v_other_id)
    OR EXISTS (SELECT 1 FROM public.asset_snapshot WHERE user_id = v_other_id)
  THEN
    RAISE EXCEPTION 'FAIL: user deletion must empty the three tables';
  END IF;

  RAISE NOTICE 'ASSET TABLES USER CASCADE: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
