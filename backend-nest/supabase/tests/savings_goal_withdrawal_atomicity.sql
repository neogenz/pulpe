-- PUL-329 — guards of the savings-goal withdrawal RPCs and of the source link.
--
-- Amounts stay ciphertexts, so PostgreSQL never recomputes the balance. What
-- it must guarantee is proven here: ownership, shape of a linked income,
-- optimistic revision, all-or-nothing writes, and survival of the income when
-- the goal is renamed or deleted.
-- Wraps in a transaction and rolls back at the end so DB state is unaffected.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_other_user_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_goal_id uuid := gen_random_uuid();
  v_spare_goal_id uuid := gen_random_uuid();
  v_other_goal_id uuid := gen_random_uuid();
  v_line_id uuid := gen_random_uuid();
  v_tag_id uuid := gen_random_uuid();
  v_withdrawal_id uuid;
  v_revision bigint;
  v_next_revision bigint;
  v_name text;
  v_source_id uuid;
  v_count int;
  v_caught text;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_id::text)::text,
    true
  );

  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES
    (v_user_id, 'goal-withdrawal@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_other_user_id, 'goal-withdrawal-other@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_template_id, v_user_id, 'Withdrawal Template', 'withdrawal test', false);

  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_budget_id, v_user_id, v_template_id, 1, 2026, 'Janvier');

  INSERT INTO public.savings_goal (id, user_id, name, status)
  VALUES
    (v_goal_id, v_user_id, 'Voyage', 'ACTIVE'::public.savings_goal_status),
    (v_spare_goal_id, v_user_id, 'Vélo', 'ACTIVE'::public.savings_goal_status),
    (v_other_goal_id, v_other_user_id, 'Autre', 'ACTIVE'::public.savings_goal_status);

  INSERT INTO public.budget_line (id, budget_id, savings_goal_id, name, amount, kind, recurrence)
  VALUES (v_line_id, v_budget_id, v_goal_id, 'Épargne voyage', 'CIPHERTEXT_400',
          'saving'::public.transaction_kind, 'one_off'::public.transaction_recurrence);

  INSERT INTO public.tag (id, user_id, name)
  VALUES (v_tag_id, v_user_id, 'Loisirs');

  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  ----------------------------------------------------------------------
  -- ASSERTION 1: another user's goal is refused
  ----------------------------------------------------------------------
  v_caught := NULL;
  BEGIN
    PERFORM public.create_savings_goal_withdrawal(
      v_other_goal_id,
      0::bigint,
      jsonb_build_object(
        'budget_id', v_budget_id,
        'name', 'Retrait',
        'amount', 'CIPHERTEXT_100',
        'kind', 'income',
        'transaction_date', '2026-01-15'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Savings goal access denied' THEN
    RAISE EXCEPTION 'FAIL [1]: foreign goal accepted (%)', COALESCE(v_caught, 'no error');
  END IF;
  RAISE NOTICE 'PASS [1] foreign goal rejected';

  ----------------------------------------------------------------------
  -- ASSERTION 2: a withdrawal is an income, never a saving or an expense
  ----------------------------------------------------------------------
  v_caught := NULL;
  BEGIN
    PERFORM public.create_savings_goal_withdrawal(
      v_goal_id,
      v_revision,
      jsonb_build_object(
        'budget_id', v_budget_id,
        'name', 'Retrait',
        'amount', 'CIPHERTEXT_100',
        'kind', 'saving',
        'transaction_date', '2026-01-15'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Savings goal withdrawal must be an income' THEN
    RAISE EXCEPTION 'FAIL [2]: non-income accepted (%)', COALESCE(v_caught, 'no error');
  END IF;
  RAISE NOTICE 'PASS [2] non-income rejected';

  ----------------------------------------------------------------------
  -- ASSERTION 3: a withdrawal stays free of any forecast
  ----------------------------------------------------------------------
  v_caught := NULL;
  BEGIN
    PERFORM public.create_savings_goal_withdrawal(
      v_goal_id,
      v_revision,
      jsonb_build_object(
        'budget_id', v_budget_id,
        'budget_line_id', v_line_id,
        'name', 'Retrait',
        'amount', 'CIPHERTEXT_100',
        'kind', 'income',
        'transaction_date', '2026-01-15'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Savings goal withdrawal must stay unallocated' THEN
    RAISE EXCEPTION 'FAIL [3]: allocated income accepted (%)', COALESCE(v_caught, 'no error');
  END IF;
  RAISE NOTICE 'PASS [3] allocated income rejected';

  ----------------------------------------------------------------------
  -- ASSERTION 4: a stale revision writes nothing
  ----------------------------------------------------------------------
  v_caught := NULL;
  BEGIN
    PERFORM public.create_savings_goal_withdrawal(
      v_goal_id,
      v_revision + 42,
      jsonb_build_object(
        'budget_id', v_budget_id,
        'name', 'Retrait',
        'amount', 'CIPHERTEXT_100',
        'kind', 'income',
        'transaction_date', '2026-01-15'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Savings goal balance changed' THEN
    RAISE EXCEPTION 'FAIL [4]: stale revision accepted (%)', COALESCE(v_caught, 'no error');
  END IF;

  SELECT count(*) INTO v_count
  FROM public.transaction WHERE source_savings_goal_id = v_goal_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [4]: % row(s) leaked from refused calls', v_count;
  END IF;
  RAISE NOTICE 'PASS [4] stale revision rejected without any write';

  ----------------------------------------------------------------------
  -- ASSERTION 5: a valid withdrawal carries its source and moves the revision
  ----------------------------------------------------------------------
  SELECT (public.create_savings_goal_withdrawal(
    v_goal_id,
    v_revision,
    jsonb_build_object(
      'budget_id', v_budget_id,
      'name', 'Retrait voyage',
      'amount', 'CIPHERTEXT_500',
      'kind', 'income',
      'transaction_date', '2026-01-15'
    ),
    ARRAY[v_tag_id]
  )).id INTO v_withdrawal_id;

  SELECT source_savings_goal_id, source_savings_goal_name
  INTO v_source_id, v_name
  FROM public.transaction WHERE id = v_withdrawal_id;

  IF v_source_id IS DISTINCT FROM v_goal_id OR v_name IS DISTINCT FROM 'Voyage' THEN
    RAISE EXCEPTION 'FAIL [5]: source snapshot not stored (% / %)', v_source_id, v_name;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.transaction_tag WHERE transaction_id = v_withdrawal_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [5]: expected 1 tag link, got %', v_count;
  END IF;

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_goal_id;
  IF v_next_revision <= v_revision THEN
    RAISE EXCEPTION 'FAIL [5]: revision did not advance (% -> %)', v_revision, v_next_revision;
  END IF;
  RAISE NOTICE 'PASS [5] withdrawal created, tagged and revision advanced';

  ----------------------------------------------------------------------
  -- ASSERTION 6: replaying the same revision cannot write a second time
  ----------------------------------------------------------------------
  v_caught := NULL;
  BEGIN
    PERFORM public.create_savings_goal_withdrawal(
      v_goal_id,
      v_revision,
      jsonb_build_object(
        'budget_id', v_budget_id,
        'name', 'Retrait rejoué',
        'amount', 'CIPHERTEXT_500',
        'kind', 'income',
        'transaction_date', '2026-01-15'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Savings goal balance changed' THEN
    RAISE EXCEPTION 'FAIL [6]: replayed revision accepted (%)', COALESCE(v_caught, 'no error');
  END IF;

  SELECT count(*) INTO v_count
  FROM public.transaction WHERE source_savings_goal_id = v_goal_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [6]: expected 1 withdrawal, got %', v_count;
  END IF;
  RAISE NOTICE 'PASS [6] two writes on the same revision cannot both succeed';

  ----------------------------------------------------------------------
  -- ASSERTION 7: a failing tag link rolls the whole withdrawal back
  ----------------------------------------------------------------------
  v_revision := v_next_revision;
  v_caught := NULL;
  BEGIN
    PERFORM public.create_savings_goal_withdrawal(
      v_goal_id,
      v_revision,
      jsonb_build_object(
        'budget_id', v_budget_id,
        'name', 'Retrait avec tags cassés',
        'amount', 'CIPHERTEXT_300',
        'kind', 'income',
        'transaction_date', '2026-01-20'
      ),
      ARRAY[v_tag_id, v_tag_id]
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS NULL THEN
    RAISE EXCEPTION 'FAIL [7]: duplicate tag link accepted';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.transaction WHERE source_savings_goal_id = v_goal_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [7]: tag failure leaked a transaction (% rows)', v_count;
  END IF;

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_goal_id;
  IF v_next_revision <> v_revision THEN
    RAISE EXCEPTION 'FAIL [7]: rolled back call still advanced the revision';
  END IF;
  RAISE NOTICE 'PASS [7] tag failure rolls back transaction and revision';

  ----------------------------------------------------------------------
  -- ASSERTION 8: editing a withdrawal advances the revision
  ----------------------------------------------------------------------
  PERFORM public.update_savings_goal_withdrawal(
    v_withdrawal_id,
    v_revision,
    jsonb_build_object('name', 'Retrait voyage corrigé', 'transaction_date', '2026-01-25')
  );

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_goal_id;
  IF v_next_revision <= v_revision THEN
    RAISE EXCEPTION 'FAIL [8]: edit did not advance the revision';
  END IF;

  SELECT name INTO v_name FROM public.transaction WHERE id = v_withdrawal_id;
  IF v_name <> 'Retrait voyage corrigé' THEN
    RAISE EXCEPTION 'FAIL [8]: edit did not apply (%)', v_name;
  END IF;
  RAISE NOTICE 'PASS [8] edit applied and revision advanced';

  ----------------------------------------------------------------------
  -- ASSERTION 9: a confirmed contribution invalidates a read balance
  ----------------------------------------------------------------------
  v_revision := v_next_revision;
  INSERT INTO public.transaction (budget_id, budget_line_id, name, amount, kind, transaction_date, checked_at)
  VALUES (v_budget_id, v_line_id, 'Virement épargne', 'CIPHERTEXT_400',
          'saving'::public.transaction_kind, '2026-01-28', now());

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_goal_id;
  IF v_next_revision <= v_revision THEN
    RAISE EXCEPTION 'FAIL [9]: contribution did not advance the revision';
  END IF;

  v_caught := NULL;
  BEGIN
    PERFORM public.update_savings_goal_withdrawal(
      v_withdrawal_id,
      v_revision,
      jsonb_build_object('amount', 'CIPHERTEXT_900')
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Savings goal balance changed' THEN
    RAISE EXCEPTION 'FAIL [9]: withdrawal ignored a concurrent contribution (%)',
      COALESCE(v_caught, 'no error');
  END IF;
  RAISE NOTICE 'PASS [9] a contribution orders itself before a stale withdrawal';

  ----------------------------------------------------------------------
  -- ASSERTION 10: deleting a withdrawal advances the revision
  ----------------------------------------------------------------------
  v_revision := v_next_revision;
  PERFORM public.delete_savings_goal_withdrawal(v_withdrawal_id, v_revision);

  SELECT count(*) INTO v_count
  FROM public.transaction WHERE id = v_withdrawal_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [10]: withdrawal survived its deletion';
  END IF;

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_goal_id;
  IF v_next_revision <= v_revision THEN
    RAISE EXCEPTION 'FAIL [10]: deletion did not advance the revision';
  END IF;
  RAISE NOTICE 'PASS [10] deletion removed the withdrawal and advanced the revision';

  ----------------------------------------------------------------------
  -- ASSERTION 11: rename follows the snapshot, deletion keeps the history
  ----------------------------------------------------------------------
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_spare_goal_id;

  SELECT (public.create_savings_goal_withdrawal(
    v_spare_goal_id,
    v_revision,
    jsonb_build_object(
      'budget_id', v_budget_id,
      'name', 'Retrait vélo',
      'amount', 'CIPHERTEXT_200',
      'kind', 'income',
      'transaction_date', '2026-01-18'
    )
  )).id INTO v_withdrawal_id;

  UPDATE public.savings_goal SET name = 'Vélo électrique' WHERE id = v_spare_goal_id;

  SELECT source_savings_goal_name INTO v_name
  FROM public.transaction WHERE id = v_withdrawal_id;
  IF v_name <> 'Vélo électrique' THEN
    RAISE EXCEPTION 'FAIL [11]: rename did not reach the snapshot (%)', v_name;
  END IF;

  DELETE FROM public.savings_goal WHERE id = v_spare_goal_id;

  SELECT source_savings_goal_id, source_savings_goal_name
  INTO v_source_id, v_name
  FROM public.transaction WHERE id = v_withdrawal_id;

  IF v_source_id IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL [11]: deleted goal left a dangling identifier';
  END IF;
  IF v_name <> 'Vélo électrique' THEN
    RAISE EXCEPTION 'FAIL [11]: deleted goal lost the last known name (%)', v_name;
  END IF;
  RAISE NOTICE 'PASS [11] rename synced, deletion kept the income and its last name';

  ----------------------------------------------------------------------
  -- ASSERTION 12: the shape of a linked income is enforced by the schema
  ----------------------------------------------------------------------
  v_caught := NULL;
  BEGIN
    INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date, source_savings_goal_id)
    VALUES (v_budget_id, 'Snapshot manquant', 'CIPHERTEXT_100',
            'income'::public.transaction_kind, '2026-01-15', v_goal_id);
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;
  IF v_caught IS NULL THEN
    RAISE EXCEPTION 'FAIL [12]: an identifier without a snapshot was accepted';
  END IF;

  v_caught := NULL;
  BEGIN
    INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date,
                                    source_savings_goal_id, source_savings_goal_name)
    VALUES (v_budget_id, 'Snapshot vide', 'CIPHERTEXT_100',
            'income'::public.transaction_kind, '2026-01-15', v_goal_id, '   ');
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;
  IF v_caught IS NULL THEN
    RAISE EXCEPTION 'FAIL [12]: a blank snapshot was accepted';
  END IF;

  v_caught := NULL;
  BEGIN
    INSERT INTO public.transaction (budget_id, budget_line_id, name, amount, kind, transaction_date,
                                    source_savings_goal_id, source_savings_goal_name)
    VALUES (v_budget_id, v_line_id, 'Lié à une prévision', 'CIPHERTEXT_100',
            'income'::public.transaction_kind, '2026-01-15', v_goal_id, 'Voyage');
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;
  IF v_caught IS NULL THEN
    RAISE EXCEPTION 'FAIL [12]: an allocated linked income was accepted';
  END IF;
  RAISE NOTICE 'PASS [12] schema rejects every malformed source link';

  RAISE NOTICE 'ALL ASSERTIONS PASSED';
END;
$$;

ROLLBACK;
