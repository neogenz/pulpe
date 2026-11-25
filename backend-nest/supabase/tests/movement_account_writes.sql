-- The account of a movement through the RPCs that rewrite every column
-- (PUL-378): `update_budget_line_with_tags` and `update_transaction_with_tags`
-- keep it when the patch has no key, write it, clear it on null; the two
-- savings-goal withdrawal RPCs write and keep it, and stay SECURITY DEFINER.
-- Run as the owner (`authenticated`). Rolled back at the end.
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
SELECT set_config('test.other_asset_id', gen_random_uuid()::text, true);

DO $$
DECLARE
  v_other_id uuid := gen_random_uuid();
  v_category_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES
    (current_setting('test.owner_id')::uuid, 'account-writes-owner@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_other_id, 'account-writes-other@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  INSERT INTO public.asset_category (id, user_id, name)
  VALUES (v_category_id, v_other_id, 'Comptes');
  INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
  VALUES (current_setting('test.other_asset_id')::uuid, v_other_id, v_category_id,
          'Compte', 'CHF', 'own');
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
  v_category_id uuid := gen_random_uuid();
  v_compte_id uuid := gen_random_uuid();   -- Compte courant, own
  v_revolut_id uuid := gen_random_uuid();  -- own
  v_livret_id uuid := gen_random_uuid();   -- own
  v_template_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_goal_id uuid := gen_random_uuid();
  v_restaurant uuid := gen_random_uuid();
  v_epargne uuid := gen_random_uuid();
  v_withdrawal uuid;
  v_plain_withdrawal uuid;
  v_revision bigint;
  v_account uuid;
BEGIN
  INSERT INTO public.asset_category (id, user_id, name)
  VALUES (v_category_id, v_owner_id, 'Comptes');
  INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
  VALUES
    (v_compte_id, v_owner_id, v_category_id, 'Compte courant', 'CHF', 'own'),
    (v_revolut_id, v_owner_id, v_category_id, 'Revolut', 'CHF', 'own'),
    (v_livret_id, v_owner_id, v_category_id, 'Livret', 'CHF', 'own');
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_owner_id, 'Modèle', '', false);
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_budget_id, v_owner_id, v_template_id, 11, 2026, 'Novembre');
  INSERT INTO public.savings_goal (id, user_id, name, status)
  VALUES (v_goal_id, v_owner_id, 'Voyage', 'ACTIVE');

  -- « Restaurant » 80 on Compte courant (CA5) and « Épargne mensuelle » 500
  -- from Compte courant, « Versée sur » Livret (CA7).
  INSERT INTO public.transaction (id, budget_id, name, amount, kind, account_id)
  VALUES (v_restaurant, v_budget_id, 'Restaurant', 'c80', 'expense', v_compte_id);
  INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence, account_id, asset_id)
  VALUES (v_epargne, v_budget_id, 'Épargne mensuelle', 'c500', 'saving', 'fixed',
          v_compte_id, v_livret_id);

  -- ---------- 1. update_transaction_with_tags ----------
  -- CA26: a patch without the key keeps the account.
  PERFORM public.update_transaction_with_tags(
    v_restaurant, jsonb_build_object('name', 'Restaurant du coin'), ARRAY[]::uuid[]);
  SELECT account_id INTO v_account FROM public.transaction WHERE id = v_restaurant;
  IF v_account IS DISTINCT FROM v_compte_id THEN
    RAISE EXCEPTION 'FAIL [1a]: an absent key must keep the account, got %', v_account;
  END IF;
  -- CA11: Restaurant moves to Revolut.
  PERFORM public.update_transaction_with_tags(
    v_restaurant, jsonb_build_object('account_id', v_revolut_id), ARRAY[]::uuid[]);
  SELECT account_id INTO v_account FROM public.transaction WHERE id = v_restaurant;
  IF v_account IS DISTINCT FROM v_revolut_id THEN
    RAISE EXCEPTION 'FAIL [1b]: the account must move to Revolut, got %', v_account;
  END IF;
  -- An explicit null clears it.
  PERFORM public.update_transaction_with_tags(
    v_restaurant, jsonb_build_object('account_id', NULL), ARRAY[]::uuid[]);
  IF (SELECT account_id FROM public.transaction WHERE id = v_restaurant) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL [1c]: an explicit null must clear the account';
  END IF;
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.update_transaction_with_tags(%L, jsonb_build_object('account_id', %L::uuid), ARRAY[]::uuid[])$f$,
    v_restaurant, v_other_asset_id), 'Account access denied');
  RAISE NOTICE 'PASS [1] update_transaction_with_tags keeps, writes and clears the account';

  -- ---------- 2. update_budget_line_with_tags ----------
  PERFORM public.update_budget_line_with_tags(
    v_epargne, jsonb_build_object('name', 'Épargne'), ARRAY[]::uuid[]);
  SELECT account_id INTO v_account FROM public.budget_line WHERE id = v_epargne;
  IF v_account IS DISTINCT FROM v_compte_id THEN
    RAISE EXCEPTION 'FAIL [2a]: an absent key must keep the account, got %', v_account;
  END IF;
  PERFORM public.update_budget_line_with_tags(
    v_epargne, jsonb_build_object('account_id', v_revolut_id), ARRAY[]::uuid[]);
  SELECT account_id INTO v_account FROM public.budget_line WHERE id = v_epargne;
  IF v_account IS DISTINCT FROM v_revolut_id THEN
    RAISE EXCEPTION 'FAIL [2b]: the account must move to Revolut, got %', v_account;
  END IF;
  -- CA25: the account cannot be the asset it already feeds.
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.update_budget_line_with_tags(%L, jsonb_build_object('account_id', %L::uuid), ARRAY[]::uuid[])$f$,
    v_epargne, v_livret_id),
    'new row for relation "budget_line" violates check constraint "budget_line_account_not_asset"');
  PERFORM public.update_budget_line_with_tags(
    v_epargne, jsonb_build_object('account_id', NULL), ARRAY[]::uuid[]);
  IF (SELECT account_id FROM public.budget_line WHERE id = v_epargne) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL [2c]: an explicit null must clear the account';
  END IF;
  RAISE NOTICE 'PASS [2] update_budget_line_with_tags keeps, writes, clears and refuses CA25';

  -- ---------- 3. Withdrawal RPCs ----------
  SELECT balance_revision INTO v_revision FROM public.savings_goal WHERE id = v_goal_id;
  -- « Retrait » 1 000 from Voyage onto Compte courant (CA9 shape).
  SELECT (public.create_savings_goal_withdrawal(
    v_goal_id, v_revision,
    jsonb_build_object('budget_id', v_budget_id, 'name', 'Retrait', 'amount', 'c1000',
                       'kind', 'income', 'transaction_date', '2026-11-05',
                       'account_id', v_compte_id)
  )).id INTO v_withdrawal;
  SELECT account_id INTO v_account FROM public.transaction WHERE id = v_withdrawal;
  IF v_account IS DISTINCT FROM v_compte_id THEN
    RAISE EXCEPTION 'FAIL [3a]: the withdrawal must store its account, got %', v_account;
  END IF;

  -- Without the key (a deployed backend), the withdrawal has no account.
  SELECT balance_revision INTO v_revision FROM public.savings_goal WHERE id = v_goal_id;
  SELECT (public.create_savings_goal_withdrawal(
    v_goal_id, v_revision,
    jsonb_build_object('budget_id', v_budget_id, 'name', 'Retrait 2', 'amount', 'c100',
                       'kind', 'income', 'transaction_date', '2026-11-06')
  )).id INTO v_plain_withdrawal;
  IF (SELECT account_id FROM public.transaction WHERE id = v_plain_withdrawal) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL [3b]: a withdrawal without the key must have no account';
  END IF;

  -- A foreign account is refused, even through the definer, and writes nothing.
  SELECT balance_revision INTO v_revision FROM public.savings_goal WHERE id = v_goal_id;
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.create_savings_goal_withdrawal(%L, %s, jsonb_build_object(
         'budget_id', %L::uuid, 'name', 'Pirate', 'amount', 'c1', 'kind', 'income',
         'transaction_date', '2026-11-07', 'account_id', %L::uuid))$f$,
    v_goal_id, v_revision, v_budget_id, v_other_asset_id), 'Account access denied');
  IF EXISTS (SELECT 1 FROM public.transaction WHERE name = 'Pirate') THEN
    RAISE EXCEPTION 'FAIL [3c]: a refused withdrawal must write nothing';
  END IF;

  -- Update: an absent key keeps, a new account replaces.
  SELECT balance_revision INTO v_revision FROM public.savings_goal WHERE id = v_goal_id;
  PERFORM public.update_savings_goal_withdrawal(
    v_withdrawal, v_revision, jsonb_build_object('name', 'Retrait voyage'));
  SELECT account_id INTO v_account FROM public.transaction WHERE id = v_withdrawal;
  IF v_account IS DISTINCT FROM v_compte_id THEN
    RAISE EXCEPTION 'FAIL [3d]: an absent key must keep the withdrawal account, got %', v_account;
  END IF;
  SELECT balance_revision INTO v_revision FROM public.savings_goal WHERE id = v_goal_id;
  PERFORM public.update_savings_goal_withdrawal(
    v_withdrawal, v_revision, jsonb_build_object('account_id', v_revolut_id));
  SELECT account_id INTO v_account FROM public.transaction WHERE id = v_withdrawal;
  IF v_account IS DISTINCT FROM v_revolut_id THEN
    RAISE EXCEPTION 'FAIL [3e]: the withdrawal account must move to Revolut, got %', v_account;
  END IF;
  RAISE NOTICE 'PASS [3] withdrawal RPCs write, keep and refuse the account';

  -- ---------- 4. Modes unchanged ----------
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND ((p.proname IN ('create_savings_goal_withdrawal', 'update_savings_goal_withdrawal')
            AND NOT p.prosecdef)
        OR (p.proname IN ('update_budget_line_with_tags', 'update_transaction_with_tags')
            AND p.prosecdef)
        OR (p.proname IN ('create_savings_goal_withdrawal', 'update_savings_goal_withdrawal',
                          'update_budget_line_with_tags', 'update_transaction_with_tags')
            AND p.proconfig IS DISTINCT FROM ARRAY['search_path=""']))
  ) THEN
    RAISE EXCEPTION 'FAIL [4]: the rewritten RPCs must keep their mode and empty search_path';
  END IF;

  RAISE NOTICE 'MOVEMENT ACCOUNT WRITES: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
