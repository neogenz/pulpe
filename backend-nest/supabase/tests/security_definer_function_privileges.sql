BEGIN;

DO $$
DECLARE
  v_signature text;
BEGIN
  IF to_regprocedure(
    'public.bulk_update_template_lines(uuid,jsonb)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: obsolete bulk_update_template_lines still exists';
  END IF;

  FOREACH v_signature IN ARRAY ARRAY[
    'public.check_unchecked_transactions(uuid)',
    'public.toggle_budget_line_check(uuid)',
    'public.toggle_transaction_check(uuid)'
  ]
  LOOP
    IF has_function_privilege('anon', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: anon can execute %', v_signature;
    END IF;

    IF NOT has_function_privilege('authenticated', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: authenticated cannot execute %', v_signature;
    END IF;

    IF NOT has_function_privilege('service_role', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: service_role cannot execute %', v_signature;
    END IF;
  END LOOP;
END;
$$;

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
