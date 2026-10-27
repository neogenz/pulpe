-- PUL-25 import ledger (20261012130000). An imported operation stays imported
-- after its Réel is deleted or postponed; deleting the budget that holds its
-- ledger row releases it. The API reads its own rows and never writes them.
-- Wraps in a transaction and rolls back at the end so DB state is unaffected.

BEGIN;

SELECT set_config('test.owner_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_id', gen_random_uuid()::text, true);
SELECT set_config('test.template_id', gen_random_uuid()::text, true);
SELECT set_config('test.budget_a', gen_random_uuid()::text, true);
SELECT set_config('test.budget_b', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES
  (current_setting('test.owner_id')::uuid, 'import-ledger-owner@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  (current_setting('test.other_id')::uuid, 'import-ledger-other@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.template (id, user_id, name, description, is_default)
VALUES (current_setting('test.template_id')::uuid,
        current_setting('test.owner_id')::uuid,
        'Import Ledger Template', 'import ledger test', false);

INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
VALUES
  (current_setting('test.budget_a')::uuid, current_setting('test.owner_id')::uuid,
   current_setting('test.template_id')::uuid, 1, 2025, 'Budget A'),
  (current_setting('test.budget_b')::uuid, current_setting('test.owner_id')::uuid,
   current_setting('test.template_id')::uuid, 2, 2025, 'Budget B');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.owner_id'))::text,
  true
);

DO $$
DECLARE
  v_budget_a uuid := current_setting('test.budget_a')::uuid;
  v_budget_b uuid := current_setting('test.budget_b')::uuid;
  v_deleted_fp text := repeat('a', 64);
  v_moved_fp text := repeat('b', 64);
  v_ledger_budget uuid;
  v_count integer;
  v_blocked boolean;
BEGIN
  ----------------------------------------------------------------------
  -- 1. The import insert records every fingerprint, and only those.
  ----------------------------------------------------------------------
  INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, import_fingerprint)
  VALUES
    (v_budget_a, 'Imported', 'CIPHERTEXT', 'expense'::public.transaction_kind, '2025-01-10', v_deleted_fp),
    (v_budget_a, 'Imported', 'CIPHERTEXT', 'expense'::public.transaction_kind, '2025-01-11', v_moved_fp),
    (v_budget_a, 'Manual', 'CIPHERTEXT', 'expense'::public.transaction_kind, '2025-01-12', NULL);

  SELECT count(*) INTO v_count FROM public.transaction_import_fingerprint;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL [1]: expected 2 ledger rows, found %', v_count;
  END IF;
  RAISE NOTICE 'PASS [1] import insert records its fingerprints';

  ----------------------------------------------------------------------
  -- 2. Deleting the Réel keeps its operation imported.
  ----------------------------------------------------------------------
  DELETE FROM public.transaction WHERE import_fingerprint = v_deleted_fp;
  IF NOT EXISTS (
    SELECT 1 FROM public.transaction_import_fingerprint WHERE fingerprint = v_deleted_fp
  ) THEN
    RAISE EXCEPTION 'FAIL [2]: deleting the Réel released its fingerprint';
  END IF;
  RAISE NOTICE 'PASS [2] ledger row outlives the deleted Réel';

  ----------------------------------------------------------------------
  -- 3. Importing it again fails the whole statement with 23505.
  ----------------------------------------------------------------------
  v_blocked := false;
  BEGIN
    INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, import_fingerprint)
    VALUES
      (v_budget_a, 'Fresh', 'CIPHERTEXT', 'expense'::public.transaction_kind, '2025-01-13', repeat('c', 64)),
      (v_budget_a, 'Again', 'CIPHERTEXT', 'expense'::public.transaction_kind, '2025-01-10', v_deleted_fp);
  EXCEPTION WHEN unique_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked OR EXISTS (
    SELECT 1 FROM public.transaction WHERE import_fingerprint = repeat('c', 64)
  ) THEN
    RAISE EXCEPTION 'FAIL [3]: re-import was not rejected as a whole';
  END IF;
  RAISE NOTICE 'PASS [3] re-import rejected with 23505, nothing written';

  ----------------------------------------------------------------------
  -- 4. A postponed Réel takes its ledger row to the new budget.
  ----------------------------------------------------------------------
  UPDATE public.transaction SET budget_id = v_budget_b
  WHERE import_fingerprint = v_moved_fp;
  SELECT budget_id INTO v_ledger_budget
  FROM public.transaction_import_fingerprint WHERE fingerprint = v_moved_fp;
  IF v_ledger_budget IS DISTINCT FROM v_budget_b THEN
    RAISE EXCEPTION 'FAIL [4]: ledger row did not follow the postponed Réel';
  END IF;
  RAISE NOTICE 'PASS [4] ledger row follows a postponed Réel';

  ----------------------------------------------------------------------
  -- 5. The API never writes the ledger directly.
  ----------------------------------------------------------------------
  v_blocked := false;
  BEGIN
    INSERT INTO public.transaction_import_fingerprint (fingerprint, budget_id)
    VALUES (repeat('d', 64), v_budget_a);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL [5]: authenticated inserted into the ledger';
  END IF;

  v_blocked := false;
  BEGIN
    DELETE FROM public.transaction_import_fingerprint;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL [5]: authenticated deleted from the ledger';
  END IF;
  RAISE NOTICE 'PASS [5] ledger is read-only for the API';

  ----------------------------------------------------------------------
  -- 6. Deleting a budget releases only the rows it still holds.
  ----------------------------------------------------------------------
  DELETE FROM public.monthly_budget WHERE id = v_budget_a;
  IF EXISTS (
    SELECT 1 FROM public.transaction_import_fingerprint WHERE fingerprint = v_deleted_fp
  ) THEN
    RAISE EXCEPTION 'FAIL [6]: deleting the budget kept its fingerprint';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.transaction_import_fingerprint WHERE fingerprint = v_moved_fp
  ) THEN
    RAISE EXCEPTION 'FAIL [6]: deleting the old budget released a postponed Réel';
  END IF;
  RAISE NOTICE 'PASS [6] budget deletion releases its own fingerprints only';
END;
$$;

----------------------------------------------------------------------
-- 7. Another account sees none of the owner's ledger.
----------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.other_id'))::text,
  true
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.transaction_import_fingerprint) THEN
    RAISE EXCEPTION 'FAIL [7]: another account can read the ledger';
  END IF;
  RAISE NOTICE 'PASS [7] ledger rows are owner-scoped';
  RAISE NOTICE 'transaction_import_fingerprint_ledger: ALL ASSERTIONS PASSED';
END;
$$;

RESET ROLE;

ROLLBACK;
