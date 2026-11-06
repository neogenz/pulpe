-- Prévisions linked to an asset: the guard trigger (tenant and kind/direction),
-- the link surviving every RPC that copies or rewrites prévision columns, the
-- independence from the savings-goal link, ON DELETE SET NULL, and the
-- security mode of the redefined RPCs.
BEGIN;

-- Runs one statement as the current role and checks the exact refusal message.
CREATE FUNCTION public.test_expect_refusal(p_sql text, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    v_message := SQLERRM;
  END;
  IF v_message IS NULL THEN
    RAISE EXCEPTION 'FAIL: expected "%" but the statement succeeded: %', p_message, p_sql;
  END IF;
  IF v_message <> p_message THEN
    RAISE EXCEPTION 'FAIL: expected "%" but got "%": %', p_message, v_message, p_sql;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.test_expect_refusal(text, text) TO authenticated;

SELECT set_config('test.owner_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_category_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_asset_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES
  (current_setting('test.owner_id')::uuid, 'asset-link-owner@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  (current_setting('test.other_id')::uuid, 'asset-link-other@local.test', 'fake',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- Another user's own asset, the target of every cross-tenant attempt.
INSERT INTO public.asset_category (id, user_id, name)
VALUES (
  current_setting('test.other_category_id')::uuid,
  current_setting('test.other_id')::uuid,
  'Immobilier'
);
INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
VALUES (
  current_setting('test.other_asset_id')::uuid,
  current_setting('test.other_id')::uuid,
  current_setting('test.other_category_id')::uuid,
  'Appartement', 'CHF', 'own'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.owner_id'))::text,
  true
);

DO $$
DECLARE
  v_owner_id uuid := current_setting('test.owner_id')::uuid;
  v_other_asset_id uuid := current_setting('test.other_asset_id')::uuid;
  v_category_id uuid := gen_random_uuid();
  v_livret_id uuid := gen_random_uuid();   -- own
  v_compte_id uuid := gen_random_uuid();   -- own
  v_leasing_id uuid := gen_random_uuid();  -- owe
  v_goal_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
  v_guard_template_id uuid := gen_random_uuid();
  v_line_saving uuid := gen_random_uuid();
  v_line_expense uuid := gen_random_uuid();
  v_line_income uuid := gen_random_uuid();
  v_line_both uuid := gen_random_uuid();
  v_new_line uuid := gen_random_uuid();
  v_guard_line uuid := gen_random_uuid();
  v_budget_id uuid;
  v_budget_ids uuid[];
  v_budget_line_id uuid;
  v_group_id uuid := gen_random_uuid();
  v_result jsonb;
  v_json json;
  v_row public.budget_line;
  v_template_row public.template_line;
  v_count integer;
  v_signature text;
  v_definition text;
BEGIN
  INSERT INTO public.asset_category (id, user_id, name)
  VALUES (v_category_id, v_owner_id, 'Épargne');
  INSERT INTO public.asset (id, user_id, category_id, name, currency, direction)
  VALUES
    (v_livret_id, v_owner_id, v_category_id, 'Livret', 'CHF', 'own'),
    (v_compte_id, v_owner_id, v_category_id, 'Compte', 'CHF', 'own'),
    (v_leasing_id, v_owner_id, v_category_id, 'Leasing', 'CHF', 'owe');
  INSERT INTO public.savings_goal (
    id, user_id, name, target_amount, start_date, target_date, status
  ) VALUES (
    v_goal_id, v_owner_id, 'Goal', 'ciphertext', '2026-01-01', '2035-12-31', 'ACTIVE'
  );

  -- ---------- 1. Guard on template_line ----------
  INSERT INTO public.template (id, user_id, name, description, is_default)
  VALUES
    (v_template_id, v_owner_id, 'Owner Template', '', false),
    (v_guard_template_id, v_owner_id, 'Guard Template', '', false);

  -- saving and income link to an own asset, expense to a debt.
  INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, asset_id)
  VALUES
    (v_guard_template_id, 'Saving', 'c', 'saving', 'fixed', v_livret_id),
    (v_guard_template_id, 'Income', 'c', 'income', 'fixed', v_livret_id),
    (v_guard_template_id, 'Expense', 'c', 'expense', 'fixed', v_leasing_id);

  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, asset_id)
       VALUES (%L, 'x', 'c', 'saving', 'fixed', %L)$f$,
    v_guard_template_id, v_leasing_id), 'Asset direction does not match the line kind');
  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, asset_id)
       VALUES (%L, 'x', 'c', 'income', 'fixed', %L)$f$,
    v_guard_template_id, v_leasing_id), 'Asset direction does not match the line kind');
  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, asset_id)
       VALUES (%L, 'x', 'c', 'expense', 'fixed', %L)$f$,
    v_guard_template_id, v_livret_id), 'Asset direction does not match the line kind');
  -- Another user's asset is refused even with a matching direction.
  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, asset_id)
       VALUES (%L, 'x', 'c', 'saving', 'fixed', %L)$f$,
    v_guard_template_id, v_other_asset_id), 'Asset access denied');
  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.template_line (template_id, name, amount, kind, recurrence, asset_id)
       VALUES (%L, 'x', 'c', 'saving', 'fixed', %L)$f$,
    v_guard_template_id, gen_random_uuid()), 'Asset access denied');

  SELECT count(*) INTO v_count FROM public.template_line
  WHERE template_id = v_guard_template_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'FAIL: refused template lines must not be written, found % lines', v_count;
  END IF;

  -- A kind change that leaves the link mismatched is refused; clearing it passes.
  SELECT id INTO v_guard_line FROM public.template_line
  WHERE template_id = v_guard_template_id AND name = 'Saving';
  PERFORM public.test_expect_refusal(format(
    $f$UPDATE public.template_line SET kind = 'expense' WHERE id = %L$f$, v_guard_line),
    'Asset direction does not match the line kind');
  UPDATE public.template_line SET kind = 'expense', asset_id = NULL WHERE id = v_guard_line;

  -- ---------- 2. The template to copy, and the two links side by side ----------
  INSERT INTO public.template_line (
    id, template_id, name, amount, kind, recurrence, savings_goal_id, asset_id
  ) VALUES
    (v_line_saving, v_template_id, 'Saving', 'c', 'saving', 'fixed', NULL, v_livret_id),
    (v_line_expense, v_template_id, 'Expense', 'c', 'expense', 'fixed', NULL, v_leasing_id),
    (v_line_income, v_template_id, 'Income', 'c', 'income', 'fixed', NULL, NULL),
    (v_line_both, v_template_id, 'Both', 'c', 'saving', 'fixed', v_goal_id, v_livret_id);

  SELECT * INTO v_template_row FROM public.template_line WHERE id = v_line_both;
  IF v_template_row.savings_goal_id IS DISTINCT FROM v_goal_id
    OR v_template_row.asset_id IS DISTINCT FROM v_livret_id
  THEN
    RAISE EXCEPTION 'FAIL: a line linked to a goal and an asset must keep both links';
  END IF;

  -- ---------- 3. Guard on budget_line ----------
  INSERT INTO public.monthly_budget (user_id, template_id, month, year, description)
  VALUES (v_owner_id, v_template_id, 12, 2028, 'Direct')
  RETURNING id INTO v_budget_id;

  INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, asset_id)
  VALUES (v_budget_id, 'Saving', 'c', 'saving', 'fixed', v_livret_id)
  RETURNING id INTO v_budget_line_id;
  INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, asset_id)
  VALUES (v_budget_id, 'Expense', 'c', 'expense', 'fixed', v_leasing_id);

  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, asset_id)
       VALUES (%L, 'x', 'c', 'saving', 'fixed', %L)$f$,
    v_budget_id, v_leasing_id), 'Asset direction does not match the line kind');
  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, asset_id)
       VALUES (%L, 'x', 'c', 'expense', 'fixed', %L)$f$,
    v_budget_id, v_livret_id), 'Asset direction does not match the line kind');
  PERFORM public.test_expect_refusal(format(
    $f$INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, asset_id)
       VALUES (%L, 'x', 'c', 'saving', 'fixed', %L)$f$,
    v_budget_id, v_other_asset_id), 'Asset access denied');
  PERFORM public.test_expect_refusal(format(
    $f$UPDATE public.budget_line SET asset_id = %L WHERE id = %L$f$,
    v_other_asset_id, v_budget_line_id), 'Asset access denied');
  PERFORM public.test_expect_refusal(format(
    $f$UPDATE public.budget_line SET kind = 'expense' WHERE id = %L$f$,
    v_budget_line_id), 'Asset direction does not match the line kind');

  INSERT INTO public.budget_line (
    budget_id, name, amount, kind, recurrence, savings_goal_id, asset_id
  ) VALUES (v_budget_id, 'Both', 'c', 'saving', 'fixed', v_goal_id, v_livret_id);
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE budget_id = v_budget_id
    AND savings_goal_id = v_goal_id
    AND asset_id = v_livret_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: a budget line linked to a goal and an asset must keep both links';
  END IF;

  -- ---------- 4. create_budget_from_template copies the link ----------
  v_result := public.create_budget_from_template(
    v_owner_id, v_template_id, 1, 2029, 'From template'
  );
  v_budget_id := (v_result -> 'budget' ->> 'id')::uuid;
  SELECT count(*) INTO v_count
  FROM public.budget_line bl
  JOIN public.template_line tl ON tl.id = bl.template_line_id
  WHERE bl.budget_id = v_budget_id
    AND bl.asset_id IS DISTINCT FROM tl.asset_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: % copied budget lines differ from their template line asset', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE budget_id = v_budget_id AND asset_id IS NOT NULL;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'FAIL: expected 3 copied lines with an asset, found %', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE budget_id = v_budget_id AND savings_goal_id = v_goal_id AND asset_id = v_livret_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: the copy must keep both links on the goal-and-asset line';
  END IF;

  -- ---------- 5. generate_budgets_from_template carries it over several months ----------
  v_result := public.generate_budgets_from_template(
    v_owner_id, v_template_id, 2, 2029, 3, '{}'::jsonb
  );
  SELECT array_agg(value::uuid) INTO v_budget_ids
  FROM jsonb_array_elements_text(v_result -> 'created_budget_ids');
  IF coalesce(array_length(v_budget_ids, 1), 0) <> 3 THEN
    RAISE EXCEPTION 'FAIL: expected 3 generated budgets, got %', v_result;
  END IF;
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE budget_id = ANY(v_budget_ids) AND asset_id IS NOT NULL;
  IF v_count <> 9 THEN
    RAISE EXCEPTION 'FAIL: expected 9 generated lines with an asset, found %', v_count;
  END IF;
  SELECT count(*) INTO v_count
  FROM public.budget_line bl
  JOIN public.template_line tl ON tl.id = bl.template_line_id
  WHERE bl.budget_id = ANY(v_budget_ids)
    AND bl.asset_id IS DISTINCT FROM tl.asset_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: % generated lines differ from their template line asset', v_count;
  END IF;

  v_budget_ids := v_budget_ids || v_budget_id;

  -- ---------- 6. apply_template_line_operations ----------
  -- Create: the new line and its propagated copies carry the asset.
  PERFORM public.apply_template_line_operations(
    template_id := v_template_id,
    budget_ids := v_budget_ids,
    created_lines := jsonb_build_array(jsonb_build_object(
      'id', v_new_line, 'name', 'New', 'amount', 'c', 'kind', 'saving',
      'recurrence', 'fixed', 'asset_id', v_livret_id
    ))
  );
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE template_line_id = v_new_line AND asset_id = v_livret_id;
  IF v_count <> 4 OR (SELECT asset_id FROM public.template_line WHERE id = v_new_line)
    IS DISTINCT FROM v_livret_id
  THEN
    RAISE EXCEPTION 'FAIL: created template line must propagate its asset to 4 budgets, found %', v_count;
  END IF;

  -- Update without the asset_id key keeps the link on both sides.
  PERFORM public.apply_template_line_operations(
    template_id := v_template_id,
    budget_ids := v_budget_ids,
    updated_lines := jsonb_build_array(jsonb_build_object('id', v_line_saving, 'name', 'Renamed'))
  );
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE template_line_id = v_line_saving AND name = 'Renamed' AND asset_id = v_livret_id;
  IF v_count <> 4 OR (SELECT asset_id FROM public.template_line WHERE id = v_line_saving)
    IS DISTINCT FROM v_livret_id
  THEN
    RAISE EXCEPTION 'FAIL: an update without asset_id must keep the link, found % budget lines', v_count;
  END IF;

  -- Update with a new asset, then with null.
  PERFORM public.apply_template_line_operations(
    template_id := v_template_id,
    budget_ids := v_budget_ids,
    updated_lines := jsonb_build_array(jsonb_build_object('id', v_line_saving, 'asset_id', v_compte_id))
  );
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE template_line_id = v_line_saving AND asset_id = v_compte_id;
  IF v_count <> 4 OR (SELECT asset_id FROM public.template_line WHERE id = v_line_saving)
    IS DISTINCT FROM v_compte_id
  THEN
    RAISE EXCEPTION 'FAIL: an updated asset must reach the template line and 4 budgets, found %', v_count;
  END IF;
  PERFORM public.apply_template_line_operations(
    template_id := v_template_id,
    budget_ids := v_budget_ids,
    updated_lines := jsonb_build_array(jsonb_build_object('id', v_line_expense, 'asset_id', NULL))
  );
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE template_line_id = v_line_expense AND asset_id IS NULL;
  IF v_count <> 4 OR (SELECT asset_id FROM public.template_line WHERE id = v_line_expense)
    IS NOT NULL
  THEN
    RAISE EXCEPTION 'FAIL: a null asset_id must clear the link on the template line and 4 budgets, found %', v_count;
  END IF;

  -- Another user's asset or a wrong direction aborts everything.
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.apply_template_line_operations(
         template_id := %L,
         budget_ids := %L::uuid[],
         created_lines := jsonb_build_array(jsonb_build_object(
           'id', gen_random_uuid(), 'name', 'x', 'amount', 'c', 'kind', 'saving',
           'recurrence', 'fixed', 'asset_id', %L))
       )$f$,
    v_template_id, v_budget_ids, v_other_asset_id), 'Asset access denied');
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.apply_template_line_operations(
         template_id := %L,
         budget_ids := %L::uuid[],
         created_lines := jsonb_build_array(jsonb_build_object(
           'id', gen_random_uuid(), 'name', 'x', 'amount', 'c', 'kind', 'saving',
           'recurrence', 'fixed', 'asset_id', %L))
       )$f$,
    v_template_id, v_budget_ids, v_leasing_id), 'Asset direction does not match the line kind');
  SELECT count(*) INTO v_count FROM public.template_line WHERE template_id = v_template_id;
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'FAIL: refused operations must leave 5 template lines, found %', v_count;
  END IF;

  -- ---------- 7. create_budget_lines_spread ----------
  SELECT count(*) INTO v_count FROM public.create_budget_lines_spread(
    v_group_id,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'budget_id', b.id, 'name', 'Spread', 'amount', 'c', 'kind', 'saving',
        'recurrence', 'one_off', 'savings_goal_id', NULL, 'asset_id', v_livret_id
      ))
      FROM unnest(v_budget_ids[1:3]) AS b(id)
    )
  );
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'FAIL: expected 3 spread lines, got %', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.budget_line
  WHERE spread_group_id = v_group_id AND asset_id = v_livret_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'FAIL: every spread line must carry the asset, found %', v_count;
  END IF;
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.create_budget_lines_spread(
         gen_random_uuid(),
         jsonb_build_array(jsonb_build_object(
           'budget_id', %L, 'name', 'x', 'amount', 'c', 'kind', 'saving',
           'recurrence', 'one_off', 'asset_id', %L)))$f$,
    v_budget_ids[1], v_other_asset_id), 'Asset access denied');

  -- ---------- 8. create_template_with_lines (new and duplicated templates) ----------
  v_json := public.create_template_with_lines(
    v_owner_id, 'Duplicate', NULL, false,
    jsonb_build_array(
      jsonb_build_object('name', 'Saving', 'amount', 'c', 'kind', 'saving',
        'recurrence', 'fixed', 'asset_id', v_livret_id),
      jsonb_build_object('name', 'Expense', 'amount', 'c', 'kind', 'expense',
        'recurrence', 'fixed', 'asset_id', v_leasing_id),
      jsonb_build_object('name', 'Plain', 'amount', 'c', 'kind', 'income',
        'recurrence', 'fixed')
    )
  );
  SELECT count(*) INTO v_count
  FROM json_array_elements(v_json -> 'template_lines') AS l
  WHERE (l ->> 'name' = 'Saving' AND l ->> 'asset_id' = v_livret_id::text)
    OR (l ->> 'name' = 'Expense' AND l ->> 'asset_id' = v_leasing_id::text)
    OR (l ->> 'name' = 'Plain' AND l -> 'asset_id' IS NOT NULL AND l ->> 'asset_id' IS NULL);
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'FAIL: the returned template lines must carry their asset_id, got %', v_json;
  END IF;
  SELECT count(*) INTO v_count FROM public.template_line
  WHERE template_id = (v_json ->> 'id')::uuid AND asset_id IS NOT NULL;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected 2 stored template lines with an asset, found %', v_count;
  END IF;
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.create_template_with_lines(%L, 'Foreign', NULL, false,
         jsonb_build_array(jsonb_build_object('name', 'x', 'amount', 'c',
           'kind', 'saving', 'recurrence', 'fixed', 'asset_id', %L)))$f$,
    v_owner_id, v_other_asset_id), 'Asset access denied');

  -- ---------- 9. Tagged updates ----------
  SELECT id INTO v_budget_line_id FROM public.budget_line
  WHERE budget_id = v_budget_ids[1] AND template_line_id = v_line_both;

  v_row := public.update_budget_line_with_tags(
    v_budget_line_id, '{"name": "Renamed"}'::jsonb, ARRAY[]::uuid[]
  );
  IF v_row.asset_id IS DISTINCT FROM v_livret_id OR v_row.savings_goal_id IS DISTINCT FROM v_goal_id THEN
    RAISE EXCEPTION 'FAIL: a patch without asset_id must keep both links';
  END IF;
  v_row := public.update_budget_line_with_tags(
    v_budget_line_id, jsonb_build_object('asset_id', v_compte_id), ARRAY[]::uuid[]
  );
  IF v_row.asset_id IS DISTINCT FROM v_compte_id OR v_row.savings_goal_id IS DISTINCT FROM v_goal_id THEN
    RAISE EXCEPTION 'FAIL: a patched asset_id must be stored without touching the goal link';
  END IF;
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.update_budget_line_with_tags(%L, %L::jsonb, ARRAY[]::uuid[])$f$,
    v_budget_line_id, jsonb_build_object('asset_id', v_other_asset_id)), 'Asset access denied');
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.update_budget_line_with_tags(%L, %L::jsonb, ARRAY[]::uuid[])$f$,
    v_budget_line_id, jsonb_build_object('asset_id', v_leasing_id)),
    'Asset direction does not match the line kind');
  -- A kind change with a new asset passes, without one it is refused.
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.update_budget_line_with_tags(%L, %L::jsonb, ARRAY[]::uuid[])$f$,
    v_budget_line_id, jsonb_build_object('kind', 'expense')),
    'Asset direction does not match the line kind');
  v_row := public.update_budget_line_with_tags(
    v_budget_line_id,
    jsonb_build_object('kind', 'expense', 'savings_goal_id', NULL, 'asset_id', v_leasing_id),
    ARRAY[]::uuid[]
  );
  IF v_row.asset_id IS DISTINCT FROM v_leasing_id OR v_row.kind <> 'expense' THEN
    RAISE EXCEPTION 'FAIL: a kind change with a matching new asset must be stored';
  END IF;
  v_row := public.update_budget_line_with_tags(
    v_budget_line_id, jsonb_build_object('asset_id', NULL), ARRAY[]::uuid[]
  );
  IF v_row.asset_id IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a null asset_id must clear the link';
  END IF;

  v_template_row := public.update_template_line_with_tags(
    v_line_saving, '{"name": "Again"}'::jsonb, ARRAY[]::uuid[]
  );
  IF v_template_row.asset_id IS DISTINCT FROM v_compte_id THEN
    RAISE EXCEPTION 'FAIL: a template patch without asset_id must keep the link';
  END IF;
  v_template_row := public.update_template_line_with_tags(
    v_line_saving, jsonb_build_object('asset_id', v_livret_id), ARRAY[]::uuid[]
  );
  IF v_template_row.asset_id IS DISTINCT FROM v_livret_id THEN
    RAISE EXCEPTION 'FAIL: a template patched asset_id must be stored';
  END IF;
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.update_template_line_with_tags(%L, %L::jsonb, ARRAY[]::uuid[])$f$,
    v_line_saving, jsonb_build_object('asset_id', v_other_asset_id)), 'Asset access denied');
  PERFORM public.test_expect_refusal(format(
    $f$SELECT public.update_template_line_with_tags(%L, %L::jsonb, ARRAY[]::uuid[])$f$,
    v_line_saving, jsonb_build_object('asset_id', v_leasing_id)),
    'Asset direction does not match the line kind');
  v_template_row := public.update_template_line_with_tags(
    v_line_saving, jsonb_build_object('asset_id', NULL), ARRAY[]::uuid[]
  );
  IF v_template_row.asset_id IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a null asset_id must clear the template link';
  END IF;

  -- ---------- 10. Deleting the asset unlinks, never deletes ----------
  SELECT count(*) INTO v_count FROM public.budget_line WHERE asset_id = v_livret_id;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'FAIL: the deletion check needs linked budget lines';
  END IF;
  SELECT count(*) INTO v_count FROM public.budget_line WHERE budget_id = ANY(v_budget_ids);
  DELETE FROM public.asset WHERE id = v_livret_id;
  IF EXISTS (
    SELECT 1 FROM public.budget_line WHERE asset_id = v_livret_id
    UNION ALL
    SELECT 1 FROM public.template_line WHERE asset_id = v_livret_id
  ) THEN
    RAISE EXCEPTION 'FAIL: deleting an asset must null every link to it';
  END IF;
  IF (SELECT count(*) FROM public.budget_line WHERE budget_id = ANY(v_budget_ids)) <> v_count THEN
    RAISE EXCEPTION 'FAIL: deleting an asset must keep its prévisions';
  END IF;

  -- ---------- 11. Security modes ----------
  -- Seven RPCs copy or rewrite prévision columns; all stay SECURITY INVOKER with
  -- an empty search_path and keep EXECUTE for authenticated and service_role.
  FOREACH v_signature IN ARRAY ARRAY[
    'public.create_budget_from_template(uuid,uuid,integer,integer,text,uuid[])',
    'public.generate_budgets_from_template(uuid,uuid,integer,integer,integer,jsonb)',
    'public.apply_template_line_operations(uuid,uuid[],uuid[],jsonb,jsonb)',
    'public.create_budget_lines_spread(uuid,jsonb,uuid,uuid)',
    'public.create_template_with_lines(uuid,text,text,boolean,jsonb)',
    'public.update_budget_line_with_tags(uuid,jsonb,uuid[])',
    'public.update_template_line_with_tags(uuid,jsonb,uuid[])'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.oid = to_regprocedure(v_signature)
        AND NOT p.prosecdef
        AND 'search_path=""' = ANY(p.proconfig)
    ) THEN
      RAISE EXCEPTION 'FAIL: % must stay SECURITY INVOKER with an empty search_path', v_signature;
    END IF;
    IF NOT has_function_privilege('authenticated', v_signature, 'EXECUTE')
      OR NOT has_function_privilege('service_role', v_signature, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'FAIL: % lost its EXECUTE grant', v_signature;
    END IF;
  END LOOP;

  -- The guard is a hardened definer that no API role can call.
  SELECT pg_get_functiondef(p.oid) INTO v_definition
  FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.enforce_asset_line_link()')
    AND p.prosecdef
    AND 'search_path=""' = ANY(p.proconfig);
  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'FAIL: enforce_asset_line_link must be a hardened SECURITY DEFINER';
  END IF;
  IF has_function_privilege('authenticated', 'public.enforce_asset_line_link()', 'EXECUTE')
    OR has_function_privilege('anon', 'public.enforce_asset_line_link()', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FAIL: the guard function must not be executable by API roles';
  END IF;

  RAISE NOTICE 'ASSET PREVISION LINK GUARD: ALL ASSERTIONS PASSED';
END $$;

ROLLBACK;
