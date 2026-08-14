-- The backend now uses the revision-checked destination entry point.
-- Keep the legacy wrapper for internal compatibility, but remove every direct
-- API path to it and to the privileged helpers used by the current wrappers.

REVOKE EXECUTE ON FUNCTION public.apply_savings_goal_plan(
  uuid, integer, jsonb, jsonb
) FROM authenticated;

REVOKE ALL ON FUNCTION public.apply_savings_goal_plan_core(
  uuid, integer, jsonb, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_savings_goal_plan_with_destinations_core(
  uuid, integer, jsonb, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.lock_savings_goal_for_withdrawal(uuid, bigint)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assert_savings_goal_withdrawal_tags(uuid[])
  FROM PUBLIC, anon, authenticated, service_role;
