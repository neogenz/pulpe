-- Planned savings-goal withdrawals — the forecast side of PUL-329.
--
-- A budget_line may now announce "this income will be drawn from that goal".
-- The projection moves; the confirmed stock does not, until a real income lands
-- ALLOCATED to that forecast. What PostgreSQL must guarantee is proven here:
-- tenancy of the link, the server-stamped snapshot name, the shape rules, the
-- provenance surviving the goal's deletion, and the allocated realization
-- passing through the same atomic RPC as a free withdrawal.
-- Wraps in a transaction and rolls back at the end so DB state is unaffected.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_other_user_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_other_template_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_other_budget_id uuid := gen_random_uuid();
  v_goal_id uuid := gen_random_uuid();
  v_spare_goal_id uuid := gen_random_uuid();
  v_other_goal_id uuid := gen_random_uuid();
  v_doomed_goal_id uuid := gen_random_uuid();
  v_plan_id uuid := gen_random_uuid();
  v_doomed_plan_id uuid := gen_random_uuid();
  v_contribution_id uuid := gen_random_uuid();
  v_free_withdrawal_id uuid := gen_random_uuid();
  v_revision bigint;
  v_next_revision bigint;
  v_name text;
  v_source_id uuid;
  v_count int;
  v_caught text;
  v_txn public.transaction;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_id::text)::text,
    true
  );

  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES
    (v_user_id, 'planned-withdrawal@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_other_user_id, 'planned-withdrawal-other@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES
    (v_template_id, v_user_id, 'Planned Template', 'planned test', false),
    (v_other_template_id, v_other_user_id, 'Autre Template', 'other user', false);

  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES
    (v_budget_id, v_user_id, v_template_id, 8, 2026, 'Août'),
    (v_other_budget_id, v_other_user_id, v_other_template_id, 8, 2026, 'Août');

  INSERT INTO public.savings_goal (id, user_id, name, status)
  VALUES
    (v_goal_id, v_user_id, 'Vacances', 'ACTIVE'::public.savings_goal_status),
    (v_spare_goal_id, v_user_id, 'Vélo', 'ACTIVE'::public.savings_goal_status),
    (v_doomed_goal_id, v_user_id, 'Déménagement', 'ACTIVE'::public.savings_goal_status),
    (v_other_goal_id, v_other_user_id, 'Autre', 'ACTIVE'::public.savings_goal_status);

  ----------------------------------------------------------------------
  -- ASSERTION 1: another user's goal cannot be named as a source
  ----------------------------------------------------------------------
  v_caught := NULL;
  BEGIN
    INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence,
                                    source_savings_goal_id)
    VALUES (gen_random_uuid(), v_budget_id, 'Retrait volé', 'CIPHERTEXT_500',
            'income'::public.transaction_kind,
            'one_off'::public.transaction_recurrence, v_other_goal_id);
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS NULL OR v_caught NOT LIKE '%Savings goal access denied%' THEN
    RAISE EXCEPTION 'FAIL [1]: cross-tenant source accepted (got: %)',
      COALESCE(v_caught, 'no error');
  END IF;

  SELECT count(*) INTO v_count
  FROM public.budget_line WHERE source_savings_goal_id = v_other_goal_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [1]: % leaked row(s) linked to another tenant', v_count;
  END IF;
  RAISE NOTICE 'PASS [1] cross-tenant source rejected, no row leaked';

  ----------------------------------------------------------------------
  -- ASSERTION 2: the server stamps the snapshot name; the client never does
  ----------------------------------------------------------------------
  INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence,
                                  source_savings_goal_id, source_savings_goal_name)
  VALUES (v_plan_id, v_budget_id, 'Retrait vacances', 'CIPHERTEXT_500',
          'income'::public.transaction_kind,
          'one_off'::public.transaction_recurrence, v_goal_id, 'Nom inventé');

  SELECT source_savings_goal_name INTO v_name
  FROM public.budget_line WHERE id = v_plan_id;
  IF v_name IS DISTINCT FROM 'Vacances' THEN
    RAISE EXCEPTION 'FAIL [2]: snapshot name is % instead of the goal name', v_name;
  END IF;
  RAISE NOTICE 'PASS [2] snapshot name stamped from the goal, client value ignored';

  ----------------------------------------------------------------------
  -- ASSERTION 3: shape rules — only an unchecked one-off income may name a
  -- source. An expense or a saving would make the movement meaningless, a
  -- recurring one would drain the goal every month without ever saying so.
  ----------------------------------------------------------------------
  FOR v_count IN 1..3 LOOP
    v_caught := NULL;
    BEGIN
      INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence,
                                      source_savings_goal_id)
      VALUES (
        gen_random_uuid(), v_budget_id, 'Forme invalide', 'CIPHERTEXT_500',
        CASE v_count
          WHEN 1 THEN 'expense'::public.transaction_kind
          WHEN 2 THEN 'saving'::public.transaction_kind
          ELSE 'income'::public.transaction_kind
        END,
        CASE v_count
          WHEN 3 THEN 'fixed'::public.transaction_recurrence
          ELSE 'one_off'::public.transaction_recurrence
        END,
        v_goal_id
      );
    EXCEPTION WHEN OTHERS THEN
      v_caught := SQLERRM;
    END;

    IF v_caught IS NULL THEN
      RAISE EXCEPTION 'FAIL [3.%]: invalid source shape accepted', v_count;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS [3] expense, saving and recurring source lines rejected';

  ----------------------------------------------------------------------
  -- ASSERTION 3b: feeding and draining the same pot at once is unreachable.
  -- enforce_savings_goal_line_link drops a contribution link on any non-saving
  -- kind, so an income can never end up holding both — the schema and the
  -- domain refuse the payload outright, the database simply cannot store it.
  ----------------------------------------------------------------------
  INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence,
                                  savings_goal_id, source_savings_goal_id)
  VALUES (gen_random_uuid(), v_budget_id, 'Double lien', 'CIPHERTEXT_500',
          'income'::public.transaction_kind,
          'one_off'::public.transaction_recurrence, v_spare_goal_id, v_goal_id);

  SELECT count(*) INTO v_count
  FROM public.budget_line
  WHERE savings_goal_id IS NOT NULL AND source_savings_goal_id IS NOT NULL;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [3b]: % line(s) hold a contribution and a source at once',
      v_count;
  END IF;
  RAISE NOTICE 'PASS [3b] contribution link dropped, no line feeds and drains at once';

  ----------------------------------------------------------------------
  -- ASSERTION 4: renaming the goal reaches the forecast
  ----------------------------------------------------------------------
  UPDATE public.savings_goal SET name = 'Vacances 2027' WHERE id = v_goal_id;

  SELECT source_savings_goal_name INTO v_name
  FROM public.budget_line WHERE id = v_plan_id;
  IF v_name IS DISTINCT FROM 'Vacances 2027' THEN
    RAISE EXCEPTION 'FAIL [4]: forecast still shows %', v_name;
  END IF;
  RAISE NOTICE 'PASS [4] rename propagates to the planned withdrawal';

  ----------------------------------------------------------------------
  -- ASSERTION 5: deleting the goal nulls the identifier and keeps the name —
  -- the provenance stays readable, the line stops being realizable
  ----------------------------------------------------------------------
  INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence,
                                  source_savings_goal_id)
  VALUES (v_doomed_plan_id, v_budget_id, 'Retrait déménagement', 'CIPHERTEXT_300',
          'income'::public.transaction_kind,
          'one_off'::public.transaction_recurrence, v_doomed_goal_id);

  DELETE FROM public.savings_goal WHERE id = v_doomed_goal_id;

  SELECT source_savings_goal_id, source_savings_goal_name
  INTO v_source_id, v_name
  FROM public.budget_line WHERE id = v_doomed_plan_id;

  IF v_source_id IS NOT NULL OR v_name IS DISTINCT FROM 'Déménagement' THEN
    RAISE EXCEPTION 'FAIL [5]: orphan state is (%, %)', v_source_id, v_name;
  END IF;
  RAISE NOTICE 'PASS [5] goal deletion leaves a null id and the last known name';

  ----------------------------------------------------------------------
  -- ASSERTION 6: a planned withdrawal advances the goal's revision, so a
  -- projection preview computed before it cannot certify a stale plan
  ----------------------------------------------------------------------
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_spare_goal_id;

  INSERT INTO public.budget_line (id, budget_id, name, amount, kind, recurrence,
                                  source_savings_goal_id)
  VALUES (gen_random_uuid(), v_budget_id, 'Retrait vélo', 'CIPHERTEXT_200',
          'income'::public.transaction_kind,
          'one_off'::public.transaction_recurrence, v_spare_goal_id);

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_spare_goal_id;

  IF v_next_revision <= v_revision THEN
    RAISE EXCEPTION 'FAIL [6]: revision stayed at % after planning a withdrawal',
      v_revision;
  END IF;
  RAISE NOTICE 'PASS [6] planning a withdrawal advances the goal revision';

  ----------------------------------------------------------------------
  -- ASSERTION 7: the atomic RPC now accepts the allocation that realizes the
  -- forecast — same function as a free withdrawal, one write path
  ----------------------------------------------------------------------
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  v_txn := public.create_savings_goal_withdrawal(
    v_goal_id,
    v_revision,
    jsonb_build_object(
      'budget_id', v_budget_id,
      'budget_line_id', v_plan_id,
      'name', 'Retrait vacances',
      'amount', 'CIPHERTEXT_500',
      'kind', 'income',
      'transaction_date', '2026-08-10'
    )
  );

  IF v_txn.budget_line_id IS DISTINCT FROM v_plan_id
    OR v_txn.source_savings_goal_id IS DISTINCT FROM v_goal_id
    OR v_txn.source_savings_goal_name IS DISTINCT FROM 'Vacances 2027'
  THEN
    RAISE EXCEPTION 'FAIL [7]: realization wrote (%, %, %)',
      v_txn.budget_line_id, v_txn.source_savings_goal_id,
      v_txn.source_savings_goal_name;
  END IF;
  RAISE NOTICE 'PASS [7] allocated realization accepted, source stamped by the server';

  ----------------------------------------------------------------------
  -- ASSERTION 8: a withdrawal may not be allocated to a forecast that never
  -- announced it — an ordinary envelope, or a plan on another goal
  ----------------------------------------------------------------------
  INSERT INTO public.budget_line (id, budget_id, savings_goal_id, name, amount,
                                  kind, recurrence)
  VALUES (v_contribution_id, v_budget_id, v_goal_id, 'Épargne vacances',
          'CIPHERTEXT_400', 'saving'::public.transaction_kind,
          'one_off'::public.transaction_recurrence);

  v_caught := NULL;
  BEGIN
    INSERT INTO public.transaction (id, budget_id, budget_line_id, name, amount, kind,
                                    transaction_date, source_savings_goal_id,
                                    source_savings_goal_name)
    VALUES (gen_random_uuid(), v_budget_id, v_contribution_id, 'Retrait mal alloué',
            'CIPHERTEXT_500', 'income'::public.transaction_kind, '2026-08-11',
            v_goal_id, 'Vacances 2027');
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS NULL OR v_caught NOT LIKE '%must realize its own forecast%' THEN
    RAISE EXCEPTION 'FAIL [8]: allocation to a contribution forecast accepted (got: %)',
      COALESCE(v_caught, 'no error');
  END IF;
  RAISE NOTICE 'PASS [8] allocation to a forecast that never announced the withdrawal rejected';

  ----------------------------------------------------------------------
  -- ASSERTION 9: the guard also covers relocating an existing withdrawal onto
  -- a forecast after the fact — budget_line_id is a watched column
  ----------------------------------------------------------------------
  v_caught := NULL;
  BEGIN
    UPDATE public.transaction
    SET budget_line_id = v_contribution_id
    WHERE id = v_txn.id;
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS NULL OR v_caught NOT LIKE '%must realize its own forecast%' THEN
    RAISE EXCEPTION 'FAIL [9]: late relocation accepted (got: %)',
      COALESCE(v_caught, 'no error');
  END IF;
  RAISE NOTICE 'PASS [9] late relocation onto a foreign forecast rejected';

  ----------------------------------------------------------------------
  -- ASSERTION 10: a realized withdrawal stays editable. It is allocated for
  -- the rest of its life, so refusing every allocated edit would lock the user
  -- out of correcting the amount they just entered.
  ----------------------------------------------------------------------
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  v_txn := public.update_savings_goal_withdrawal(
    v_txn.id,
    v_revision,
    jsonb_build_object('amount', 'CIPHERTEXT_450')
  );

  IF v_txn.amount IS DISTINCT FROM 'CIPHERTEXT_450'
    OR v_txn.budget_line_id IS DISTINCT FROM v_plan_id
  THEN
    RAISE EXCEPTION 'FAIL [10]: edit wrote (%, %)', v_txn.amount, v_txn.budget_line_id;
  END IF;
  RAISE NOTICE 'PASS [10] realized withdrawal edited, allocation preserved';

  ----------------------------------------------------------------------
  -- ASSERTION 11: the allocation itself is immutable. The UPDATE never writes
  -- budget_line_id, so a patch claiming to move it would be silently dropped
  -- and the caller would believe a move happened that never did.
  ----------------------------------------------------------------------
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  v_caught := NULL;
  BEGIN
    PERFORM public.update_savings_goal_withdrawal(
      v_txn.id,
      v_revision,
      jsonb_build_object('budget_line_id', v_contribution_id)
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Savings goal withdrawal allocation is immutable' THEN
    RAISE EXCEPTION 'FAIL [11]: allocation move accepted (%)',
      COALESCE(v_caught, 'no error');
  END IF;

  SELECT budget_line_id INTO v_source_id
  FROM public.transaction WHERE id = v_txn.id;
  IF v_source_id IS DISTINCT FROM v_plan_id THEN
    RAISE EXCEPTION 'FAIL [11]: allocation moved to %', v_source_id;
  END IF;
  RAISE NOTICE 'PASS [11] allocation move rejected, forecast link intact';

  ----------------------------------------------------------------------
  -- ASSERTION 12: the one-off data repair points only an allocated Real
  -- whose income forecast names the same source goal. A free withdrawal from
  -- that goal remains unpointed. Keep this UPDATE identical to migration
  -- 20260808130000_backfill_linked_savings_goal_realizations_checked.sql.
  ----------------------------------------------------------------------
  INSERT INTO public.transaction (
    id, budget_id, name, amount, kind, transaction_date,
    source_savings_goal_id, source_savings_goal_name
  ) VALUES (
    v_free_withdrawal_id, v_budget_id, 'Retrait libre', 'CIPHERTEXT_100',
    'income'::public.transaction_kind, '2026-08-12',
    v_goal_id, 'Vacances 2027'
  );

  UPDATE public.transaction AS tx
  SET checked_at = tx.created_at
  FROM public.budget_line AS line
  WHERE tx.checked_at IS NULL
    AND tx.kind = 'income'::public.transaction_kind
    AND tx.budget_line_id = line.id
    AND tx.budget_id = line.budget_id
    AND tx.source_savings_goal_id IS NOT NULL
    AND line.kind = 'income'::public.transaction_kind
    AND line.source_savings_goal_id = tx.source_savings_goal_id;

  IF (SELECT checked_at FROM public.transaction WHERE id = v_txn.id) IS NULL THEN
    RAISE EXCEPTION 'FAIL [12]: allocated realization stayed unpointed';
  END IF;
  IF (SELECT checked_at FROM public.transaction WHERE id = v_free_withdrawal_id) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL [12]: free withdrawal was pointed by the backfill';
  END IF;
  RAISE NOTICE 'PASS [12] backfill points only the allocated realization';

  RAISE NOTICE '=== PLANNED SAVINGS GOAL WITHDRAWALS: ALL ASSERTIONS PASSED ===';
END $$;

ROLLBACK;
