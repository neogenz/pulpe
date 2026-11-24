-- PUL-377 CA17: a suggestion dismissed before the switch never comes back.
-- Runs the real migration file on dismissals stored before it, twice: it
-- copies the last snapshot, dated from the dismissal, once per asset dismissed
-- after its last snapshot. Its trigger then does the same for a dismissal the
-- old backend writes later, as the owner.
-- PUL-377 CA11: checking or unchecking a linked prévision writes no snapshot.
--
-- Run from backend-nest/ (the \ir path is relative to this file).
BEGIN;

SELECT set_config('test.owner_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES (current_setting('test.owner_id')::uuid, 'asset-dismissal@local.test', 'fake',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- The database as it was before the migration.
DROP TRIGGER snapshot_dismissed_asset_suggestion ON public.asset;

DO $$
DECLARE
  v_owner_id uuid := current_setting('test.owner_id')::uuid;
  v_category_id uuid;
  v_livret_id uuid;
  v_applied_id uuid;
  v_live_id uuid;
  v_template_id uuid;
  v_budget_id uuid;
BEGIN
  INSERT INTO public.asset_category (user_id, name)
  VALUES (v_owner_id, 'Épargne') RETURNING id INTO v_category_id;

  INSERT INTO public.asset (user_id, category_id, name, currency, direction)
  VALUES (v_owner_id, v_category_id, 'Livret', 'CHF', 'own')
  RETURNING id INTO v_livret_id;
  INSERT INTO public.asset (user_id, category_id, name, currency, direction)
  VALUES (v_owner_id, v_category_id, 'Compte', 'CHF', 'own')
  RETURNING id INTO v_applied_id;
  INSERT INTO public.asset (user_id, category_id, name, currency, direction)
  VALUES (v_owner_id, v_category_id, 'Revolut', 'CHF', 'own')
  RETURNING id INTO v_live_id;
  PERFORM set_config('test.livret_id', v_livret_id::text, true);
  PERFORM set_config('test.applied_id', v_applied_id::text, true);
  PERFORM set_config('test.live_id', v_live_id::text, true);

  -- Livret entered at 10 000; Compte applied a suggestion after its dismissal.
  INSERT INTO public.asset_snapshot (user_id, asset_id, value, recorded_at) VALUES
    (v_owner_id, v_livret_id, 'ct-livret-10000', now() - interval '3 days'),
    (v_owner_id, v_applied_id, 'ct-compte-old', now() - interval '3 days'),
    (v_owner_id, v_applied_id, 'ct-compte-applied', now() - interval '1 day'),
    (v_owner_id, v_live_id, 'ct-revolut-400', now() - interval '3 days');

  -- « Épargne mensuelle » (500) checked, then its suggestion dismissed; an
  -- Épargne of 200 checked after the dismissal.
  INSERT INTO public.template (user_id, name, description, is_default)
  VALUES (v_owner_id, 'Modèle', '', false) RETURNING id INTO v_template_id;
  INSERT INTO public.monthly_budget (user_id, template_id, month, year, description)
  VALUES (v_owner_id, v_template_id, 12, 2028, 'Décembre') RETURNING id INTO v_budget_id;
  PERFORM set_config('test.budget_id', v_budget_id::text, true);
  INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, asset_id, checked_at) VALUES
    (v_budget_id, 'Épargne mensuelle', 'ct-500', 'saving', 'fixed', v_livret_id, now() - interval '2 days 12 hours'),
    (v_budget_id, 'Épargne', 'ct-200', 'saving', 'one_off', v_livret_id, now() - interval '1 day');

  -- Dismissals stored before the migration, at a past instant.
  ALTER TABLE public.asset DISABLE TRIGGER stamp_asset_suggestion_dismissal;
  UPDATE public.asset SET suggestion_dismissed_at = now() - interval '2 days'
  WHERE id IN (v_livret_id, v_applied_id);
  ALTER TABLE public.asset ENABLE TRIGGER stamp_asset_suggestion_dismissal;
END;
$$;

\ir ../migrations/20261124120000_asset_value_follows_checked_lines.sql

DO $$
DECLARE
  v_livret_id uuid := current_setting('test.livret_id')::uuid;
  v_latest record;
  v_counted text[];
BEGIN
  -- Livret dismissed after its last entry: that entry, dated from the dismissal.
  SELECT value, recorded_at INTO v_latest
  FROM public.asset_latest_snapshot WHERE asset_id = v_livret_id;
  IF v_latest.value <> 'ct-livret-10000'
    OR v_latest.recorded_at <> now() - interval '2 days'
  THEN
    RAISE EXCEPTION 'FAIL: the dismissed Livret must restart from its entry, dated from the dismissal';
  END IF;

  -- What the API then counts on top of 10 000 (the repository reads the lines
  -- checked after the last snapshot): the 200 only, so 10 200, never 10 700.
  SELECT array_agg(amount ORDER BY amount) INTO v_counted
  FROM public.budget_line
  WHERE asset_id = v_livret_id AND checked_at > v_latest.recorded_at;
  IF v_counted IS DISTINCT FROM ARRAY['ct-200'] THEN
    RAISE EXCEPTION 'FAIL: after the conversion only the Épargne of 200 counts, got %', v_counted;
  END IF;

  -- Compte applied after its dismissal: its last entry already wins.
  IF (SELECT count(*) FROM public.asset_snapshot
      WHERE asset_id = current_setting('test.applied_id')::uuid) <> 2 THEN
    RAISE EXCEPTION 'FAIL: an asset applied after its dismissal gets no copy';
  END IF;
  IF (SELECT count(*) FROM public.asset_snapshot WHERE asset_id = v_livret_id) <> 2 THEN
    RAISE EXCEPTION 'FAIL: the first run must copy the Livret once';
  END IF;
END;
$$;

-- Run again (after the switch, for dismissals made in between): idempotent.
DROP TRIGGER snapshot_dismissed_asset_suggestion ON public.asset;
\ir ../migrations/20261124120000_asset_value_follows_checked_lines.sql

DO $$
BEGIN
  IF (SELECT count(*) FROM public.asset_snapshot
      WHERE asset_id = current_setting('test.livret_id')::uuid) <> 2
    OR (SELECT count(*) FROM public.asset_snapshot
        WHERE asset_id = current_setting('test.applied_id')::uuid) <> 2
  THEN
    RAISE EXCEPTION 'FAIL: a second run must copy nothing';
  END IF;
END;
$$;

-- As the owner, through what the installed apps and the old backend call.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.owner_id'))::text,
  true
);

DO $$
DECLARE
  v_live_id uuid := current_setting('test.live_id')::uuid;
  v_livret_id uuid := current_setting('test.livret_id')::uuid;
  v_latest record;
  v_line_id uuid;
  v_before integer;
  v_line record;
BEGIN
  -- The old backend dismisses Revolut after the migration: the trigger copies.
  UPDATE public.asset SET suggestion_dismissed_at = now() WHERE id = v_live_id;
  SELECT value, recorded_at INTO v_latest
  FROM public.asset_latest_snapshot WHERE asset_id = v_live_id;
  IF v_latest.value <> 'ct-revolut-400' OR v_latest.recorded_at <> now() THEN
    RAISE EXCEPTION 'FAIL: a later dismissal must be copied by the trigger';
  END IF;

  -- Writing the same instant again copies nothing more.
  UPDATE public.asset SET suggestion_dismissed_at = now() WHERE id = v_live_id;
  IF (SELECT count(*) FROM public.asset_snapshot WHERE asset_id = v_live_id) <> 2 THEN
    RAISE EXCEPTION 'FAIL: the trigger must copy once per dismissal';
  END IF;

  -- Any other edit of the asset copies nothing.
  UPDATE public.asset SET name = 'Revolut CHF' WHERE id = v_live_id;
  IF (SELECT count(*) FROM public.asset_snapshot WHERE asset_id = v_live_id) <> 2 THEN
    RAISE EXCEPTION 'FAIL: editing the name must not write a snapshot';
  END IF;

  -- CA11: checking then unchecking a linked prévision, through the RPC.
  INSERT INTO public.budget_line (budget_id, name, amount, kind, recurrence, asset_id)
  VALUES (current_setting('test.budget_id')::uuid, 'Versement', 'ct-300', 'saving', 'one_off', v_livret_id)
  RETURNING id INTO v_line_id;
  SELECT count(*) INTO v_before FROM public.asset_snapshot WHERE asset_id = v_livret_id;

  v_line := public.toggle_budget_line_check(v_line_id);
  IF v_line.checked_at IS NULL THEN
    RAISE EXCEPTION 'FAIL: the linked prévision was not checked';
  END IF;
  v_line := public.toggle_budget_line_check(v_line_id);
  IF v_line.checked_at IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the linked prévision was not unchecked';
  END IF;

  IF (SELECT count(*) FROM public.asset_snapshot WHERE asset_id = v_livret_id) <> v_before THEN
    RAISE EXCEPTION 'FAIL: checking or unchecking must not write a snapshot';
  END IF;

  RAISE NOTICE 'asset_dismissed_suggestion_conversion: ALL ASSERTIONS PASSED';
END;
$$;

ROLLBACK;
