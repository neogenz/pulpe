BEGIN;

DO $$
DECLARE
  v_signature text;
  v_is_definer boolean;
  v_all_signatures constant text[] := ARRAY[
    'public.apply_savings_goal_deletion(uuid,text,jsonb)',
    'public.apply_savings_goal_generation_stop(uuid,text,uuid[],integer)',
    'public.apply_savings_goal_plan(uuid,integer,jsonb,jsonb)',
    'public.apply_savings_goal_plan_with_destinations(uuid,integer,jsonb,jsonb,bigint)',
    'public.apply_template_line_operations(uuid,uuid[],uuid[],jsonb,jsonb)',
    'public.check_unchecked_transactions(uuid)',
    'public.create_budget_lines_spread(uuid,jsonb,uuid,uuid)',
    'public.create_savings_goal_withdrawal(uuid,bigint,jsonb,uuid[])',
    'public.create_template_with_lines(uuid,text,text,boolean,jsonb)',
    'public.delete_savings_goal_withdrawal(uuid,bigint)',
    'public.get_savings_goal_deletion_impact(uuid)',
    'public.reconcile_savings_goal_target_date(uuid,text,uuid[],date,jsonb)',
    'public.toggle_budget_line_check(uuid)',
    'public.toggle_transaction_check(uuid)',
    'public.update_savings_goal_withdrawal(uuid,bigint,jsonb,uuid[])'
  ];
  v_authenticated_signatures constant text[] := ARRAY[
    'public.apply_savings_goal_deletion(uuid,text,jsonb)',
    'public.apply_savings_goal_generation_stop(uuid,text,uuid[],integer)',
    'public.apply_savings_goal_plan_with_destinations(uuid,integer,jsonb,jsonb,bigint)',
    'public.apply_template_line_operations(uuid,uuid[],uuid[],jsonb,jsonb)',
    'public.check_unchecked_transactions(uuid)',
    'public.create_budget_lines_spread(uuid,jsonb,uuid,uuid)',
    'public.create_savings_goal_withdrawal(uuid,bigint,jsonb,uuid[])',
    'public.create_template_with_lines(uuid,text,text,boolean,jsonb)',
    'public.delete_savings_goal_withdrawal(uuid,bigint)',
    'public.get_savings_goal_deletion_impact(uuid)',
    'public.reconcile_savings_goal_target_date(uuid,text,uuid[],date,jsonb)',
    'public.toggle_budget_line_check(uuid)',
    'public.toggle_transaction_check(uuid)',
    'public.update_savings_goal_withdrawal(uuid,bigint,jsonb,uuid[])'
  ];
  v_invoker_signatures constant text[] := ARRAY[
    'public.check_unchecked_transactions(uuid)',
    'public.get_savings_goal_deletion_impact(uuid)',
    'public.toggle_budget_line_check(uuid)',
    'public.toggle_transaction_check(uuid)'
  ];
BEGIN
  IF to_regprocedure(
    'public.bulk_update_template_lines(uuid,jsonb)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: obsolete bulk_update_template_lines still exists';
  END IF;

  FOREACH v_signature IN ARRAY v_all_signatures
  LOOP
    IF to_regprocedure(v_signature) IS NULL THEN
      RAISE EXCEPTION 'FAIL: expected function % does not exist', v_signature;
    END IF;

    SELECT p.prosecdef INTO v_is_definer
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(v_signature);

    IF v_is_definer IS DISTINCT FROM NOT (
      v_signature = ANY(v_invoker_signatures)
    ) THEN
      RAISE EXCEPTION 'FAIL: % has the wrong security mode', v_signature;
    END IF;

    IF has_function_privilege('anon', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: anon can execute %', v_signature;
    END IF;

    IF NOT has_function_privilege('service_role', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: service_role cannot execute %', v_signature;
    END IF;
  END LOOP;

  FOREACH v_signature IN ARRAY v_authenticated_signatures
  LOOP
    IF NOT has_function_privilege('authenticated', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: authenticated cannot execute %', v_signature;
    END IF;
  END LOOP;

  IF has_function_privilege(
    'authenticated',
    'public.apply_savings_goal_plan(uuid,integer,jsonb,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated can execute the legacy plan RPC';
  END IF;
END;
$$;

DO $$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.apply_savings_goal_plan_core(uuid,integer,jsonb,jsonb)',
    'public.apply_savings_goal_plan_with_destinations_core(uuid,integer,jsonb,jsonb)',
    'public.assert_savings_goal_withdrawal_tags(uuid[])',
    'public.lock_savings_goal_for_withdrawal(uuid,bigint)'
  ]
  LOOP
    IF to_regprocedure(v_signature) IS NULL THEN
      RAISE EXCEPTION 'FAIL: expected internal function % does not exist', v_signature;
    END IF;

    IF has_function_privilege('anon', v_signature, 'EXECUTE')
      OR has_function_privilege('authenticated', v_signature, 'EXECUTE')
      OR has_function_privilege('service_role', v_signature, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'FAIL: an API role can execute internal function %', v_signature;
    END IF;
  END LOOP;
END;
$$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_denied boolean := false;
  v_goal_id uuid := gen_random_uuid();
  v_message text;
  v_state text;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text)::text,
    true
  );

  BEGIN
    PERFORM public.apply_savings_goal_plan(
      v_goal_id, 0, '[]'::jsonb, '[]'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'FAIL: authenticated direct legacy call was not denied';
  END IF;

  BEGIN
    PERFORM public.apply_savings_goal_plan_with_destinations(
      v_goal_id, 0, '[]'::jsonb, '[]'::jsonb, 0
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_message = MESSAGE_TEXT,
      v_state = RETURNED_SQLSTATE;
  END;
  IF v_state IS DISTINCT FROM 'P0001'
    OR v_message IS DISTINCT FROM 'Savings goal access denied'
  THEN
    RAISE EXCEPTION 'FAIL: current wrapper returned %: %', v_state, v_message;
  END IF;
END;
$$;

RESET ROLE;

CREATE FUNCTION public.default_function_privilege_probe()
RETURNS boolean
LANGUAGE sql
AS 'SELECT true';

DO $$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.default_function_privilege_probe()',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.default_function_privilege_probe()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: new functions are executable without an explicit grant';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.default_function_privilege_probe()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: service_role lost its default function access';
  END IF;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE 'SECURITY DEFINER FUNCTION PRIVILEGES: ALL ASSERTIONS PASSED';
END;
$$;

ROLLBACK;
