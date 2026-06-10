-- Security regression test (PUL-272): apply_template_line_operations must reject
-- cross-user budget injection (IDOR). The function is SECURITY DEFINER so it
-- bypasses RLS; its only authorization check is template ownership. An
-- authenticated attacker who owns their own template must NOT be able to write
-- budget_line rows into another user's budget by passing the victim's budget_id
-- in budget_ids.
--
-- TDD: against the pre-fix function this test FAILS — the ghost line is injected
-- into the victim's budget and no exception is raised. After the
-- 20260610120000_secure_apply_template_line_operations hardening migration it
-- PASSES: the function raises 'Budget access denied' (P0001) and writes nothing.
--
-- Wraps in a transaction and rolls back at the end so DB state is unaffected.

BEGIN;

DO $$
DECLARE
  v_attacker_id          uuid := gen_random_uuid();
  v_victim_id            uuid := gen_random_uuid();
  v_attacker_template_id uuid := gen_random_uuid();
  v_victim_template_id   uuid := gen_random_uuid();
  v_attacker_budget_id   uuid := gen_random_uuid();
  v_victim_budget_id     uuid := gen_random_uuid();
  v_ghost_line_id        uuid := gen_random_uuid();
  v_nominal_line_id      uuid := gen_random_uuid();
  v_caught               boolean;
  v_injected_count       int;
BEGIN
  -- Auth users (FK targets for template.user_id / monthly_budget.user_id).
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES
    (v_attacker_id, 'attacker@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_victim_id, 'victim@local.test', 'fake',
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  -- The attacker is the authenticated requester.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_attacker_id::text)::text,
    true
  );

  -- Attacker owns their template — passes the only ownership guard (line 56).
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_attacker_template_id, v_attacker_id, 'Attacker Template', '', false);

  -- Victim owns their own template + budget. The attacker never had access.
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES (v_victim_template_id, v_victim_id, 'Victim Template', '', false);

  -- Attacker's own budget (control case for the nominal path).
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_attacker_budget_id, v_attacker_id, v_attacker_template_id, 6, 2026, 'Attacker June');

  -- Victim's budget (the cross-tenant target).
  INSERT INTO public.monthly_budget (id, user_id, template_id, month, year, description)
  VALUES (v_victim_budget_id, v_victim_id, v_victim_template_id, 7, 2026, 'Victim July');

  -- ---------- ATTACK: inject a ghost budget_line into the victim's budget ----------
  -- Attacker passes their OWN template_id (clears the ownership guard) but the
  -- VICTIM's budget_id. The unconstrained INSERT propagation (function step 3)
  -- would otherwise write a ghost budget_line into the victim's budget — with an
  -- amount ciphertext encrypted under the attacker's DEK, so it decrypts to 0
  -- for the victim (silent corruption).
  v_caught := false;
  BEGIN
    PERFORM public.apply_template_line_operations(
      template_id := v_attacker_template_id,
      budget_ids := ARRAY[v_victim_budget_id]::uuid[],
      created_lines := jsonb_build_array(
        jsonb_build_object(
          'id', v_ghost_line_id,
          'name', 'GHOST',
          'amount', 'CIPHERTEXT_ATTACKER_DEK',
          'kind', 'expense',
          'recurrence', 'fixed'
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    RAISE NOTICE 'PASS 1/3: cross-user injection rejected: %', SQLERRM;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL: cross-user call did not raise — IDOR is open';
  END IF;

  -- The victim's budget must contain zero injected lines (the function is atomic,
  -- so even a rejected call must leave no partial write).
  SELECT count(*) INTO v_injected_count
  FROM public.budget_line WHERE budget_id = v_victim_budget_id;
  IF v_injected_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: % ghost budget_line(s) leaked into victim budget', v_injected_count;
  END IF;
  RAISE NOTICE 'PASS 2/3: victim budget has zero injected lines';

  -- ---------- NOMINAL: attacker propagating to their OWN budget still works ----------
  PERFORM public.apply_template_line_operations(
    template_id := v_attacker_template_id,
    budget_ids := ARRAY[v_attacker_budget_id]::uuid[],
    created_lines := jsonb_build_array(
      jsonb_build_object(
        'id', v_nominal_line_id,
        'name', 'Legit Line',
        'amount', 'CIPHERTEXT_OWN',
        'kind', 'expense',
        'recurrence', 'fixed'
      )
    )
  );
  SELECT count(*) INTO v_injected_count
  FROM public.budget_line
  WHERE budget_id = v_attacker_budget_id AND template_line_id = v_nominal_line_id;
  IF v_injected_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: nominal own-budget propagation broken, count = %', v_injected_count;
  END IF;
  RAISE NOTICE 'PASS 3/3: nominal own-budget propagation intact';

  RAISE NOTICE 'CROSS-USER IDOR GUARD: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
