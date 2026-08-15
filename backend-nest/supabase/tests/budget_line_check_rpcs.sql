-- Owner success and cross-tenant rejection under the authenticated role prove
-- that both budget-line check RPCs now rely on table RLS.

BEGIN;

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'budget-line-check-owner@local.test',
    'fake',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'budget-line-check-other@local.test',
    'fake',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  );

INSERT INTO public.template (id, user_id, name, description, is_default)
VALUES
  (
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000001',
    'Owner template',
    '',
    false
  ),
  (
    '10000000-0000-0000-0000-000000000012',
    '10000000-0000-0000-0000-000000000002',
    'Other template',
    '',
    false
  );

INSERT INTO public.monthly_budget (
  id, user_id, template_id, month, year, description
)
VALUES
  (
    '10000000-0000-0000-0000-000000000021',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000011',
    1,
    2030,
    ''
  ),
  (
    '10000000-0000-0000-0000-000000000022',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000012',
    1,
    2030,
    ''
  );

INSERT INTO public.budget_line (
  id, budget_id, name, amount, kind, recurrence, checked_at
)
VALUES
  (
    '10000000-0000-0000-0000-000000000031',
    '10000000-0000-0000-0000-000000000021',
    'Owner line',
    'enc-owner',
    'expense',
    'one_off',
    NULL
  ),
  (
    '10000000-0000-0000-0000-000000000032',
    '10000000-0000-0000-0000-000000000022',
    'Other line',
    'enc-other',
    'expense',
    'one_off',
    NULL
  );

INSERT INTO public.transaction (
  id, budget_id, budget_line_id, name, amount, kind, transaction_date, checked_at
)
VALUES
  (
    '10000000-0000-0000-0000-000000000041',
    '10000000-0000-0000-0000-000000000021',
    '10000000-0000-0000-0000-000000000031',
    'Owner movement',
    'enc-owner',
    'expense',
    '2030-01-15',
    NULL
  ),
  (
    '10000000-0000-0000-0000-000000000042',
    '10000000-0000-0000-0000-000000000022',
    '10000000-0000-0000-0000-000000000032',
    'Other movement',
    'enc-other',
    'expense',
    '2030-01-15',
    NULL
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001"}',
  true
);

DO $$
DECLARE
  v_line public.budget_line;
  v_transaction public.transaction;
  v_denied boolean;
BEGIN
  v_line := public.toggle_budget_line_check(
    '10000000-0000-0000-0000-000000000031'
  );
  IF v_line.checked_at IS NULL THEN
    RAISE EXCEPTION 'FAIL: owner budget line was not checked';
  END IF;

  SELECT checked.* INTO v_transaction
  FROM public.check_unchecked_transactions(
    '10000000-0000-0000-0000-000000000031'
  ) AS checked;
  IF v_transaction.id IS DISTINCT FROM
    '10000000-0000-0000-0000-000000000041'::uuid
    OR v_transaction.checked_at IS NULL
  THEN
    RAISE EXCEPTION 'FAIL: owner movement was not checked';
  END IF;

  v_denied := false;
  BEGIN
    PERFORM public.toggle_budget_line_check(
      '10000000-0000-0000-0000-000000000032'
    );
  EXCEPTION WHEN OTHERS THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'FAIL: cross-user budget line toggle succeeded';
  END IF;

  v_denied := false;
  BEGIN
    PERFORM public.check_unchecked_transactions(
      '10000000-0000-0000-0000-000000000032'
    );
  EXCEPTION WHEN OTHERS THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'FAIL: cross-user movement check succeeded';
  END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.budget_line
    WHERE id = '10000000-0000-0000-0000-000000000032'
      AND checked_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.transaction
    WHERE id = '10000000-0000-0000-0000-000000000042'
      AND checked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: cross-user rows were modified';
  END IF;

  RAISE NOTICE 'BUDGET LINE CHECK RPCS: ALL ASSERTIONS PASSED';
END;
$$;

ROLLBACK;
