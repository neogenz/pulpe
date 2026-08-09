-- The historical four-argument RPC must remain callable while older pods are
-- draining, but it carries no certified balance revision. Keep its line-update
-- compatibility and fail closed before any lock or write when a caller tries
-- to use it for a plan withdrawal.

CREATE OR REPLACE FUNCTION public.apply_savings_goal_plan(
  p_goal_id uuid,
  p_min_period_index int,
  p_line_updates jsonb DEFAULT '[]'::jsonb,
  p_plan_withdrawals jsonb DEFAULT '[]'::jsonb
) RETURNS SETOF public.budget_line
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_plan_withdrawals IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION 'Legacy plan withdrawals require certified revision'
      USING ERRCODE = 'P0001';
  END IF;

  -- One order for everyone: plan lock, then withdrawal lock, then the goal row.
  PERFORM pg_advisory_xact_lock(
    hashtext('apply_savings_goal_plan'),
    hashtext(p_goal_id::text)
  );
  PERFORM pg_advisory_xact_lock(
    hashtext('savings_goal_withdrawal'),
    hashtext(p_goal_id::text)
  );
  PERFORM 1
  FROM public.savings_goal sg
  WHERE sg.id = p_goal_id AND sg.user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings goal access denied' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.apply_savings_goal_plan_core(
    p_goal_id, p_min_period_index, p_line_updates, p_plan_withdrawals
  );
END;
$$;

ALTER FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_savings_goal_plan(uuid, int, jsonb, jsonb)
  TO authenticated, service_role;
