-- Two real sessions insert the 5th template of a user who owns 4. The limit
-- trigger must queue them on its per-user lock: one commits, the other counts
-- 5 and is refused. Without the lock both count 4 and the user ends with 6.
-- Like savings_goal_plan_concurrency.sql, the fixture is committed so the other
-- sessions see it, and removed in its own statement before any rethrow.

CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;

CREATE TEMP TABLE template_limit_race (user_id uuid NOT NULL)
ON COMMIT PRESERVE ROWS;
CREATE TEMP TABLE template_limit_race_error (message text NOT NULL)
ON COMMIT PRESERVE ROWS;
INSERT INTO template_limit_race VALUES (gen_random_uuid());

INSERT INTO auth.users (
  id, email, encrypted_password, instance_id, aud, role,
  confirmation_token, recovery_token, email_change_token_new
)
SELECT
  user_id, 'template-limit-race-' || user_id || '@local.test', 'fake',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  '', '', ''
FROM template_limit_race;
INSERT INTO public.template (user_id, name, description, is_default)
SELECT user_id, 'Seed ' || i, 'race', false
FROM template_limit_race, generate_series(1, 4) AS i;

DO $$
DECLARE
  -- savings_goal_plan_concurrency.sql explains why dblink dials inet_server_addr().
  v_connection text := format(
    'hostaddr=%s port=%s dbname=%s user=%s password=postgres',
    inet_server_addr(), inet_server_port(), current_database(), current_user
  );
  v_sessions text[] := ARRAY['template_race_a', 'template_race_b'];
  v_session text;
  v_user_id uuid;
  v_waiting integer := 0;
  v_outcomes text[] := '{}';
  v_count integer;
BEGIN
  SELECT user_id INTO v_user_id FROM template_limit_race;

  -- Hold the trigger's lock so both inserts provably queue behind it.
  PERFORM pg_advisory_lock(hashtext('template_limit'), hashtext(v_user_id::text));

  FOREACH v_session IN ARRAY v_sessions LOOP
    PERFORM extensions.dblink_connect(
      v_session, v_connection || ' application_name=' || v_session
    );
    PERFORM extensions.dblink_send_query(v_session, format(
      'INSERT INTO public.template (user_id, name, description, is_default)
       VALUES (%L, %L, %L, false)',
      v_user_id, v_session, 'race'
    ));
  END LOOP;

  FOR i IN 1..300 LOOP
    -- pg_stat_activity is snapshotted per transaction: refresh it each poll.
    PERFORM pg_stat_clear_snapshot();
    SELECT count(*) INTO v_waiting
    FROM pg_stat_activity
    WHERE application_name = ANY (v_sessions) AND wait_event = 'advisory';
    EXIT WHEN v_waiting = 2;
    PERFORM pg_sleep(0.01);
  END LOOP;
  IF v_waiting <> 2 THEN
    RAISE EXCEPTION 'FAIL: % of 2 inserts waited on the template limit lock',
      v_waiting;
  END IF;

  PERFORM pg_advisory_unlock(hashtext('template_limit'), hashtext(v_user_id::text));

  FOREACH v_session IN ARRAY v_sessions LOOP
    PERFORM * FROM extensions.dblink_get_result(v_session, false) AS r(status text);
    v_outcomes := v_outcomes || extensions.dblink_error_message(v_session);
    PERFORM extensions.dblink_disconnect(v_session);
  END LOOP;

  IF (SELECT count(*) FROM unnest(v_outcomes) o WHERE o = 'OK') <> 1
    OR (SELECT count(*) FROM unnest(v_outcomes) o
        WHERE o LIKE '%TEMPLATE_LIMIT_EXCEEDED%') <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected one insert and one limit refusal, got %',
      v_outcomes;
  END IF;

  SELECT count(*) INTO v_count FROM public.template WHERE user_id = v_user_id;
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'FAIL: concurrent inserts left % templates, limit is 5', v_count;
  END IF;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_advisory_unlock_all();
  FOREACH v_session IN ARRAY v_sessions LOOP
    BEGIN
      PERFORM extensions.dblink_disconnect(v_session);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  INSERT INTO template_limit_race_error (message) VALUES (SQLERRM);
END $$;

-- Templates cascade from the user row.
DELETE FROM auth.users WHERE id IN (SELECT user_id FROM template_limit_race);

DO $$
DECLARE
  v_error text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users u JOIN template_limit_race f ON f.user_id = u.id
  ) THEN
    RAISE EXCEPTION 'FAIL: template limit race fixture cleanup left its user';
  END IF;

  SELECT string_agg(message, E'\n') INTO v_error FROM template_limit_race_error;
  IF v_error IS NOT NULL THEN
    RAISE EXCEPTION '%', v_error;
  END IF;

  RAISE NOTICE 'TEMPLATE LIMIT CONCURRENCY: ALL ASSERTIONS PASSED';
END $$;
