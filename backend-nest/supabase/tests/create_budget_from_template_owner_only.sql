-- Bug #2 verification: create_budget_from_template restricted to template owner.
-- 1. Owner can create budget from their own template (control case — must succeed).
-- 2. Other user's private template is rejected (always was, still is).
-- NOTE: schema enforces template.user_id NOT NULL, so public templates
--       (user_id IS NULL) literally cannot be inserted. The migration fix is
--       defense-in-depth — guards against future schema relaxation.

BEGIN;

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_other_id uuid := gen_random_uuid();
  v_owner_template_id uuid := gen_random_uuid();
  v_other_template_id uuid := gen_random_uuid();
  v_result jsonb;
  v_caught boolean;
BEGIN
  -- Auth users + RLS context (owner is the requester).
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES (v_owner_id, 'owner@local.test', 'fake',
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
  VALUES (v_other_id, 'other@local.test', 'fake',
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner_id::text)::text,
    true
  );

  -- Templates: owner's + other user's.
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES
    (v_owner_template_id, v_owner_id, 'Owner Template', '', false),
    (v_other_template_id, v_other_id, 'Other Template', '', false);

  INSERT INTO public.template_line (template_id, name, amount, kind, recurrence)
  VALUES
    (v_owner_template_id, 'Salary', 'CT_X', 'income', 'fixed'),
    (v_other_template_id, 'Salary', 'CT_X', 'income', 'fixed');

  -- 1. Owner's template — must succeed.
  v_result := public.create_budget_from_template(
    p_user_id := v_owner_id,
    p_template_id := v_owner_template_id,
    p_month := 7,
    p_year := 2026,
    p_description := 'July'
  );
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'FAIL: owner template should have created budget';
  END IF;
  RAISE NOTICE 'PASS 1/2: owner template creates budget';

  -- 2. Other user's template — must be rejected.
  v_caught := false;
  BEGIN
    PERFORM public.create_budget_from_template(
      p_user_id := v_owner_id,
      p_template_id := v_other_template_id,
      p_month := 9,
      p_year := 2026,
      p_description := 'Sep'
    );
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
    RAISE NOTICE 'PASS 2/2: other user template rejected: %', SQLERRM;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL: other user template should have been rejected';
  END IF;

  RAISE NOTICE 'OWNER-ONLY RPC: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
