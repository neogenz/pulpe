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
  v_other_tag_id uuid := gen_random_uuid();
  v_withdrawal_id uuid;
  v_revision bigint;
  v_next_revision bigint;
  v_name text;
  v_source_id uuid;
  v_count int;
  v_caught text;
  v_impact_keys text[];
  v_other_template_id uuid := gen_random_uuid();
  v_other_budget_id uuid := gen_random_uuid();
  v_other_withdrawal_id uuid := gen_random_uuid();
  v_probe_id uuid;
  v_guard_txn_id uuid := gen_random_uuid();
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
  VALUES
    (v_tag_id, v_user_id, 'Loisirs'),
    (v_other_tag_id, v_other_user_id, 'Loisirs autrui');

  -- The other user needs a budget of their own, and a withdrawal inside it, so
  -- the cross-tenant guards have a real target to refuse rather than a
  -- nonexistent identifier.
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_other_template_id, v_other_user_id, 'Autre Template', 'other user', false);

  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_other_budget_id, v_other_user_id, v_other_template_id, 1, 2026, 'Janvier');

  INSERT INTO public.transaction (id, budget_id, name, amount, kind, transaction_date,
                                  source_savings_goal_id, source_savings_goal_name)
  VALUES (v_other_withdrawal_id, v_other_budget_id, 'Retrait autrui', 'CIPHERTEXT_700',
          'income'::public.transaction_kind, '2026-01-12', v_other_goal_id, 'Autre');

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
  -- The RPC no longer deletes transaction_tag itself; ON DELETE CASCADE does.
  -- Assert the links really were there first, or the check below is vacuous.
  SELECT count(*) INTO v_count
  FROM public.transaction_tag WHERE transaction_id = v_withdrawal_id;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'FAIL [10]: the withdrawal carried no tag link, the cascade check would prove nothing';
  END IF;

  v_revision := v_next_revision;
  PERFORM public.delete_savings_goal_withdrawal(v_withdrawal_id, v_revision);

  SELECT count(*) INTO v_count
  FROM public.transaction WHERE id = v_withdrawal_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [10]: withdrawal survived its deletion';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.transaction_tag WHERE transaction_id = v_withdrawal_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [10]: tag links survived the withdrawal, the cascade did not fire';
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

  ----------------------------------------------------------------------
  -- ASSERTION 13: the deletion preview announces exactly the expected keys
  ----------------------------------------------------------------------
  -- The repository parses this payload through a strict schema, so a key the
  -- function grows or loses breaks the endpoint outright. Pinning the contract
  -- here makes that drift fail against the real function instead of in prod.
  SELECT array_agg(key ORDER BY key)
  INTO v_impact_keys
  FROM jsonb_object_keys(public.get_savings_goal_deletion_impact(v_goal_id)) AS key;

  IF v_impact_keys IS DISTINCT FROM
     ARRAY['budgets', 'goalId', 'revision', 'templateLines', 'withdrawals']
  THEN
    RAISE EXCEPTION 'FAIL [13]: deletion impact keys drifted (%)', v_impact_keys;
  END IF;
  RAISE NOTICE 'PASS [13] deletion impact exposes the awaited key set';

  ----------------------------------------------------------------------
  -- ASSERTION 14: a transaction reaching no goal leaves the revision alone
  ----------------------------------------------------------------------
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  INSERT INTO public.transaction (budget_id, name, amount, kind, transaction_date)
  VALUES (v_budget_id, 'Courses', 'CIPHERTEXT_50',
          'expense'::public.transaction_kind, '2026-01-20');

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  IF v_next_revision <> v_revision THEN
    RAISE EXCEPTION 'FAIL [14]: an unlinked transaction moved the revision (% -> %)',
      v_revision, v_next_revision;
  END IF;
  RAISE NOTICE 'PASS [14] an unlinked transaction leaves every goal untouched';

  ----------------------------------------------------------------------
  -- ASSERTION 15: a withdrawal cannot be written into someone else's budget
  ----------------------------------------------------------------------
  -- These RPCs are SECURITY DEFINER, so they run past RLS. The budget-ownership
  -- check is the only thing between a crafted budget_id and a write into
  -- another tenant's month.
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  v_caught := NULL;
  BEGIN
    PERFORM public.create_savings_goal_withdrawal(
      v_goal_id,
      v_revision,
      jsonb_build_object(
        'budget_id', v_other_budget_id,
        'name', 'Retrait chez le voisin',
        'amount', 'CIPHERTEXT_100',
        'kind', 'income',
        'transaction_date', '2026-01-15'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Budget access denied' THEN
    RAISE EXCEPTION 'FAIL [15]: a foreign budget was accepted (%)',
      COALESCE(v_caught, 'no error');
  END IF;

  SELECT count(*) INTO v_count
  FROM public.transaction WHERE budget_id = v_other_budget_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [15]: the refused write still reached the foreign budget (% rows)', v_count;
  END IF;
  RAISE NOTICE 'PASS [15] a foreign budget refuses the write and keeps its own rows';

  ----------------------------------------------------------------------
  -- ASSERTION 16: only your own withdrawal can be edited
  ----------------------------------------------------------------------
  -- One branch answers three distinct threats: an identifier that does not
  -- exist, a transaction of yours that is not a withdrawal, and a withdrawal
  -- belonging to someone else.
  FOR v_probe_id IN
    SELECT unnest(ARRAY[gen_random_uuid(), v_withdrawal_id, v_other_withdrawal_id])
  LOOP
    v_caught := NULL;
    BEGIN
      PERFORM public.update_savings_goal_withdrawal(
        v_probe_id,
        v_revision,
        jsonb_build_object('name', 'Détourné')
      );
    EXCEPTION WHEN OTHERS THEN
      v_caught := SQLERRM;
    END;

    IF v_caught IS DISTINCT FROM 'Savings goal withdrawal not found' THEN
      RAISE EXCEPTION 'FAIL [16]: edit accepted on % (%)',
        v_probe_id, COALESCE(v_caught, 'no error');
    END IF;
  END LOOP;

  SELECT name INTO v_name
  FROM public.transaction WHERE id = v_other_withdrawal_id;
  IF v_name <> 'Retrait autrui' THEN
    RAISE EXCEPTION 'FAIL [16]: another user''s withdrawal was renamed (%)', v_name;
  END IF;
  RAISE NOTICE 'PASS [16] edit refuses an unknown, an ordinary and a foreign row';

  ----------------------------------------------------------------------
  -- ASSERTION 17: only your own withdrawal can be deleted
  ----------------------------------------------------------------------
  -- Same three threats as the edit, but a bypass here destroys the row for good.
  FOR v_probe_id IN
    SELECT unnest(ARRAY[gen_random_uuid(), v_withdrawal_id, v_other_withdrawal_id])
  LOOP
    v_caught := NULL;
    BEGIN
      PERFORM public.delete_savings_goal_withdrawal(v_probe_id, v_revision);
    EXCEPTION WHEN OTHERS THEN
      v_caught := SQLERRM;
    END;

    IF v_caught IS DISTINCT FROM 'Savings goal withdrawal not found' THEN
      RAISE EXCEPTION 'FAIL [17]: deletion accepted on % (%)',
        v_probe_id, COALESCE(v_caught, 'no error');
    END IF;
  END LOOP;

  SELECT count(*) INTO v_count
  FROM public.transaction
  WHERE id IN (v_withdrawal_id, v_other_withdrawal_id);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL [17]: a refused deletion still removed a row (% left)', v_count;
  END IF;
  RAISE NOTICE 'PASS [17] deletion refuses an unknown, an ordinary and a foreign row';

  ----------------------------------------------------------------------
  -- ASSERTION 18: an edit cannot move a withdrawal into a foreign budget
  ----------------------------------------------------------------------
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  SELECT (public.create_savings_goal_withdrawal(
    v_goal_id,
    v_revision,
    jsonb_build_object(
      'budget_id', v_budget_id,
      'name', 'Retrait déplaçable',
      'amount', 'CIPHERTEXT_300',
      'kind', 'income',
      'transaction_date', '2026-01-22'
    )
  )).id INTO v_probe_id;

  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  v_caught := NULL;
  BEGIN
    PERFORM public.update_savings_goal_withdrawal(
      v_probe_id,
      v_revision,
      jsonb_build_object('budget_id', v_other_budget_id)
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Budget access denied' THEN
    RAISE EXCEPTION 'FAIL [18]: a withdrawal was moved into a foreign budget (%)',
      COALESCE(v_caught, 'no error');
  END IF;

  SELECT budget_id INTO v_source_id
  FROM public.transaction WHERE id = v_probe_id;
  IF v_source_id <> v_budget_id THEN
    RAISE EXCEPTION 'FAIL [18]: the refused move still relocated the row';
  END IF;
  RAISE NOTICE 'PASS [18] a refused relocation leaves the withdrawal where it was';

  ----------------------------------------------------------------------
  -- ASSERTION 19: editing the starting stock invalidates a read balance
  ----------------------------------------------------------------------
  -- The starting stock is part of the balance, so changing it must make every
  -- withdrawal computed against the old one stale — and an edit that changes
  -- nothing must not burn a revision.
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  UPDATE public.savings_goal
  SET initial_amount = 'CIPHERTEXT_5000'
  WHERE id = v_goal_id;

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_goal_id;
  IF v_next_revision <= v_revision THEN
    RAISE EXCEPTION 'FAIL [19]: a new starting stock did not advance the revision (% -> %)',
      v_revision, v_next_revision;
  END IF;

  v_revision := v_next_revision;
  UPDATE public.savings_goal
  SET initial_amount = 'CIPHERTEXT_5000'
  WHERE id = v_goal_id;

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_goal_id;
  IF v_next_revision <> v_revision THEN
    RAISE EXCEPTION 'FAIL [19]: an unchanged starting stock burned a revision (% -> %)',
      v_revision, v_next_revision;
  END IF;

  v_caught := NULL;
  BEGIN
    PERFORM public.delete_savings_goal_withdrawal(v_probe_id, v_revision - 1);
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Savings goal balance changed' THEN
    RAISE EXCEPTION 'FAIL [19]: a balance read before the edit was still accepted (%)',
      COALESCE(v_caught, 'no error');
  END IF;
  RAISE NOTICE 'PASS [19] the starting stock moves the revision only when it changes';

  ----------------------------------------------------------------------
  -- ASSERTION 20: a direct write cannot link a foreign goal
  ----------------------------------------------------------------------
  -- Assertion 1 proves the RPC refuses it. This one bypasses the RPC entirely,
  -- the way a client holding the publishable key reaches PostgREST: RLS only
  -- judges the budget, so without the tenancy trigger both writes below land.
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_other_goal_id;

  v_caught := NULL;
  BEGIN
    INSERT INTO public.transaction
      (id, budget_id, budget_line_id, name, amount, kind, transaction_date,
       source_savings_goal_id, source_savings_goal_name)
    VALUES (v_guard_txn_id, v_budget_id, NULL, 'Forged link',
            'CIPHERTEXT_100', 'income'::public.transaction_kind, '2026-01-20',
            v_other_goal_id, 'whatever');
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Savings goal access denied' THEN
    RAISE EXCEPTION 'FAIL [20]: a direct INSERT linked a foreign goal (%)',
      COALESCE(v_caught, 'no error');
  END IF;

  -- The failed INSERT rolled its subtransaction back, so the id is free again.
  INSERT INTO public.transaction
    (id, budget_id, budget_line_id, name, amount, kind, transaction_date)
  VALUES (v_guard_txn_id, v_budget_id, NULL, 'Prime',
          'CIPHERTEXT_100', 'income'::public.transaction_kind, '2026-01-21');

  v_caught := NULL;
  BEGIN
    UPDATE public.transaction
    SET source_savings_goal_id = v_other_goal_id,
        source_savings_goal_name = 'whatever'
    WHERE id = v_guard_txn_id;
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Savings goal access denied' THEN
    RAISE EXCEPTION 'FAIL [20]: a direct UPDATE linked a foreign goal (%)',
      COALESCE(v_caught, 'no error');
  END IF;

  -- The refused writes must leave the target goal exactly as it was.
  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_other_goal_id;
  IF v_next_revision <> v_revision THEN
    RAISE EXCEPTION 'FAIL [20]: a refused link still moved the foreign revision (% -> %)',
      v_revision, v_next_revision;
  END IF;
  RAISE NOTICE 'PASS [20] a direct write cannot link another user''s goal';

  ----------------------------------------------------------------------
  -- ASSERTION 21: the guard refuses foreign goals, not every goal
  ----------------------------------------------------------------------
  -- A guard that rejected its own tenant too would pass assertion 20 while
  -- breaking the feature.
  UPDATE public.transaction
  SET source_savings_goal_id = v_goal_id,
      source_savings_goal_name = 'Vacances'
  WHERE id = v_guard_txn_id;

  SELECT source_savings_goal_id INTO v_source_id
  FROM public.transaction WHERE id = v_guard_txn_id;
  IF v_source_id IS DISTINCT FROM v_goal_id THEN
    RAISE EXCEPTION 'FAIL [21]: linking an own goal was refused';
  END IF;
  RAISE NOTICE 'PASS [21] linking an own goal still works';

  ----------------------------------------------------------------------
  -- ASSERTION 22: a withdrawal cannot borrow someone else's tag
  ----------------------------------------------------------------------
  -- assert_savings_goal_withdrawal_tags is the only thing standing between a
  -- caller and another tenant's tag: transaction_tag carries no RLS of its own
  -- and the FK only proves the tag exists. Assertion 7 exercises the same
  -- function through a duplicate identifier, which trips the primary key long
  -- before ownership is ever consulted — so the tenancy branch itself has no
  -- coverage without this one.
  -- Re-read rather than reuse v_next_revision: assertion 21 relinked a
  -- transaction to this goal, and that write moved the revision.
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;
  v_caught := NULL;
  BEGIN
    PERFORM public.create_savings_goal_withdrawal(
      v_goal_id,
      v_revision,
      jsonb_build_object(
        'budget_id', v_budget_id,
        'name', 'Retrait avec tag emprunté',
        'amount', 'CIPHERTEXT_120',
        'kind', 'income',
        'transaction_date', '2026-01-27'
      ),
      ARRAY[v_other_tag_id]
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Tag access denied' THEN
    RAISE EXCEPTION 'FAIL [22]: expected the tag guard, got %',
      COALESCE(v_caught, 'no error at all');
  END IF;

  -- The refusal must leave nothing behind: no link to the borrowed tag, and no
  -- revision moved by a write that never happened.
  SELECT count(*) INTO v_count
  FROM public.transaction_tag WHERE tag_id = v_other_tag_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [22]: the refused write still linked a foreign tag';
  END IF;

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_goal_id;
  IF v_next_revision <> v_revision THEN
    RAISE EXCEPTION 'FAIL [22]: a refused write still advanced the revision';
  END IF;
  RAISE NOTICE 'PASS [22] a foreign tag is refused and writes nothing';

  ----------------------------------------------------------------------
  -- ASSERTION 23: moving the start date invalidates a read balance
  ----------------------------------------------------------------------
  -- The start date anchors the contribution window, so pushing it forward
  -- drops earlier forecasts out of the confirmed stock without touching an
  -- amount. Same contract as the starting stock: it burns a revision when it
  -- changes, and only then.
  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  UPDATE public.savings_goal
  SET start_date = DATE '2026-03-01'
  WHERE id = v_goal_id;

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_goal_id;
  IF v_next_revision <= v_revision THEN
    RAISE EXCEPTION 'FAIL [23]: a new start date did not advance the revision (% -> %)',
      v_revision, v_next_revision;
  END IF;

  v_revision := v_next_revision;
  UPDATE public.savings_goal
  SET start_date = DATE '2026-03-01'
  WHERE id = v_goal_id;

  SELECT balance_revision INTO v_next_revision
  FROM public.savings_goal WHERE id = v_goal_id;
  IF v_next_revision <> v_revision THEN
    RAISE EXCEPTION 'FAIL [23]: an unchanged start date burned a revision (% -> %)',
      v_revision, v_next_revision;
  END IF;

  v_caught := NULL;
  BEGIN
    PERFORM public.delete_savings_goal_withdrawal(v_probe_id, v_revision - 1);
  EXCEPTION WHEN OTHERS THEN
    v_caught := SQLERRM;
  END;

  IF v_caught IS DISTINCT FROM 'Savings goal balance changed' THEN
    RAISE EXCEPTION 'FAIL [23]: a balance read before the move was still accepted (%)',
      COALESCE(v_caught, 'no error');
  END IF;
  RAISE NOTICE 'PASS [23] the start date moves the revision only when it changes';

  RAISE NOTICE 'ALL ASSERTIONS PASSED';
END;
$$;

ROLLBACK;
