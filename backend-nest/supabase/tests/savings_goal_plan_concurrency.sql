-- Two real PostgreSQL sessions race a withdrawal realization and a plan
-- destination change from the same certified balance revision. Realization is
-- queued first behind the shared advisory lock; the plan must then fail its
-- revision CAS before deleting/replacing the realized forecast.

CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;

CREATE TEMP TABLE savings_goal_plan_concurrency_fixture (
  user_id uuid NOT NULL,
  goal_id uuid NOT NULL,
  template_id uuid NOT NULL,
  budget_id uuid NOT NULL,
  line_id uuid NOT NULL,
  transaction_id uuid NOT NULL
) ON COMMIT PRESERVE ROWS;

INSERT INTO savings_goal_plan_concurrency_fixture
VALUES (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
);

INSERT INTO auth.users (
  id, email, encrypted_password, instance_id, aud, role,
  confirmation_token, recovery_token, email_change_token_new
)
SELECT
  user_id, 'sg-plan-concurrency-' || user_id || '@local.test', 'fake',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  '', '', ''
FROM savings_goal_plan_concurrency_fixture;
INSERT INTO public.savings_goal (
  id, user_id, name, target_amount, initial_amount, target_date, status
)
SELECT goal_id, user_id, 'Maison', 'enc-target', 'enc-stock', '2031-06-01', 'ACTIVE'
FROM savings_goal_plan_concurrency_fixture;
INSERT INTO public.template (id, user_id, name, description, is_default)
SELECT template_id, user_id, 'Plan test', '', false
FROM savings_goal_plan_concurrency_fixture;
INSERT INTO public.monthly_budget (
  id, user_id, template_id, month, year, description
)
SELECT budget_id, user_id, template_id, 6, 2030, ''
FROM savings_goal_plan_concurrency_fixture;
INSERT INTO public.budget_line (
  id, budget_id, name, amount, kind, recurrence,
  source_savings_goal_id, is_manually_adjusted,
  is_savings_goal_plan_adjustment
)
SELECT
  line_id, budget_id, 'Retrait — Maison', 'enc-forecast',
  'income', 'one_off', goal_id, true, true
FROM savings_goal_plan_concurrency_fixture;

DO $$
DECLARE
  -- dblink runs inside the database container. The Docker host gateway reaches
  -- the same local database through its authenticated host-mapped listener.
  v_connection text := 'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres';
  v_user_id uuid;
  v_goal_id uuid;
  v_budget_id uuid;
  v_line_id uuid;
  v_transaction_id uuid;
  v_revision bigint;
  v_result text;
  v_error text;
  v_count integer;
  v_realization_waiting boolean := false;
  v_plan_waiting boolean := false;
  v_definition text;
  v_plan_lock_at integer;
  v_goal_lock_at integer;
BEGIN
  SELECT user_id, goal_id, budget_id, line_id, transaction_id
  INTO v_user_id, v_goal_id, v_budget_id, v_line_id, v_transaction_id
  FROM savings_goal_plan_concurrency_fixture;

  SELECT balance_revision INTO v_revision
  FROM public.savings_goal WHERE id = v_goal_id;

  PERFORM extensions.dblink_connect(
    'sg_plan_realize',
    v_connection || ' application_name=sg_plan_realize'
  );
  PERFORM extensions.dblink_connect(
    'sg_plan_apply',
    v_connection || ' application_name=sg_plan_apply'
  );

  -- Hold the exact lock both RPCs now use so their waiting state is observable
  -- and the intended queue order is deterministic.
  PERFORM pg_advisory_lock(
    hashtext('savings_goal_withdrawal'),
    hashtext(v_goal_id::text)
  );

  PERFORM extensions.dblink_send_query('sg_plan_realize', format($realize$
    WITH claims AS (
      SELECT set_config(
        'request.jwt.claims',
        %L,
        false
      )
    )
    SELECT (public.create_savings_goal_withdrawal(
      %L::uuid,
      %s,
      jsonb_build_object(
        'id', %L::uuid,
        'budget_id', %L::uuid,
        'budget_line_id', %L::uuid,
        'name', 'Reprise',
        'amount', 'enc-real',
        'kind', 'income',
        'transaction_date', '2030-06-10T00:00:00Z',
        'checked_at', '2030-06-10T00:00:00Z'
      ),
      NULL
    )).id::text
    FROM claims;
  $realize$,
    json_build_object('sub', v_user_id::text)::text,
    v_goal_id, v_revision, v_transaction_id, v_budget_id, v_line_id
  ));

  FOR v_count IN 1..100 LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_stat_activity
      WHERE application_name = 'sg_plan_realize'
        AND wait_event = 'advisory'
    ) INTO v_realization_waiting;
    EXIT WHEN v_realization_waiting;
    PERFORM pg_sleep(0.01);
  END LOOP;
  IF NOT v_realization_waiting THEN
    RAISE EXCEPTION 'FAIL: realization did not reach the shared lock';
  END IF;

  PERFORM extensions.dblink_send_query('sg_plan_apply', format($plan$
    WITH claims AS (
      SELECT set_config(
        'request.jwt.claims',
        %L,
        false
      )
    )
    SELECT public.apply_savings_goal_plan_with_destinations(
      %L::uuid,
      %s,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'month', 6,
        'year', 2030,
        'amount', 'enc-plan',
        'destination', 'goal_only'
      )),
      %s
    )::text
    FROM claims;
  $plan$,
    json_build_object('sub', v_user_id::text)::text,
    v_goal_id, 2030 * 12 + 6, v_revision
  ));

  FOR v_count IN 1..100 LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_stat_activity
      WHERE application_name = 'sg_plan_apply'
        AND wait_event = 'advisory'
    ) INTO v_plan_waiting;
    EXIT WHEN v_plan_waiting;
    PERFORM pg_sleep(0.01);
  END LOOP;
  IF NOT v_plan_waiting THEN
    RAISE EXCEPTION 'FAIL: plan did not reach the shared lock';
  END IF;

  PERFORM pg_advisory_unlock(
    hashtext('savings_goal_withdrawal'),
    hashtext(v_goal_id::text)
  );

  SELECT id INTO v_result
  FROM extensions.dblink_get_result('sg_plan_realize') AS realized(id text);
  IF v_result IS DISTINCT FROM v_transaction_id::text THEN
    RAISE EXCEPTION 'FAIL: queued realization did not commit';
  END IF;

  SELECT result INTO v_result
  FROM extensions.dblink_get_result('sg_plan_apply', false) AS applied(result text);
  v_error := extensions.dblink_error_message('sg_plan_apply');
  IF v_error NOT LIKE '%Savings goal balance changed%' THEN
    RAISE EXCEPTION 'FAIL: stale plan did not fail its revision CAS: %', v_error;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.transaction tx
  WHERE tx.id = v_transaction_id
    AND tx.budget_line_id = v_line_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: realization was detached or lost';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.budget_line bl
  WHERE bl.id = v_line_id
    AND bl.is_savings_goal_plan_adjustment;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: stale plan deleted the realized forecast';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.savings_goal_plan_withdrawal w
  WHERE w.savings_goal_id = v_goal_id AND w.month = 6 AND w.year = 2030;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: stale plan wrote a second withdrawal representation';
  END IF;

  -- The guard above only holds while every entry point on that name demands a
  -- revision. An overload without one would silently be picked by any caller
  -- that omits the argument.
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'apply_savings_goal_plan_with_destinations'
    AND NOT ('p_expected_revision' = ANY(COALESCE(p.proargnames, '{}'::text[])));
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: % plan destination entry point(s) skip the revision CAS', v_count;
  END IF;

  -- Lock order. reconcile_savings_goal_target_date takes the plan advisory lock
  -- before the goal row lock (20260726122000). Both plan entry points must take
  -- their locks in that same order — plan lock, then withdrawal lock, then the
  -- goal row — or two of these RPCs deadlock on one goal. A deadlock here is
  -- arbitrated into a replayable 409, never silent, so this is asserted on the
  -- installed definitions rather than raced.
  FOR v_definition IN
    -- Strip line comments: they name these very locks, and a comment must not
    -- be able to pass or fail an assertion about executed statements.
    SELECT regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'apply_savings_goal_plan',
        'apply_savings_goal_plan_with_destinations'
      )
  LOOP
    v_plan_lock_at := position('hashtext(''apply_savings_goal_plan'')' in v_definition);
    v_goal_lock_at := LEAST(
      NULLIF(position('hashtext(''savings_goal_withdrawal'')' in v_definition), 0),
      NULLIF(position('lock_savings_goal_for_withdrawal' in v_definition), 0),
      NULLIF(position('FOR UPDATE' in v_definition), 0)
    );
    IF v_plan_lock_at = 0 THEN
      RAISE EXCEPTION 'FAIL: a plan entry point never takes the plan advisory lock';
    END IF;
    IF v_goal_lock_at IS NOT NULL AND v_plan_lock_at > v_goal_lock_at THEN
      RAISE EXCEPTION 'FAIL: a plan entry point locks the goal before the plan lock';
    END IF;
  END LOOP;

  PERFORM extensions.dblink_disconnect('sg_plan_realize');
  PERFORM extensions.dblink_disconnect('sg_plan_apply');
  DELETE FROM auth.users WHERE id = v_user_id;

  RAISE NOTICE 'SAVINGS GOAL PLAN CONCURRENCY: ALL ASSERTIONS PASSED';
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_advisory_unlock(
    hashtext('savings_goal_withdrawal'),
    hashtext(v_goal_id::text)
  );
  BEGIN
    PERFORM extensions.dblink_disconnect('sg_plan_realize');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    PERFORM extensions.dblink_disconnect('sg_plan_apply');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  DELETE FROM auth.users WHERE id = v_user_id;
  RAISE;
END $$;
