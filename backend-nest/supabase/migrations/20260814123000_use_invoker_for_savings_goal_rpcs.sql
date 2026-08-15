-- These autonomous mutations are fully covered by owner-scoped RLS. The
-- withdrawal/plan wrappers and auth.users-backed reconciliation remain definers.

ALTER FUNCTION public.apply_savings_goal_deletion(
  uuid, text, jsonb
) SECURITY INVOKER;
ALTER FUNCTION public.apply_savings_goal_generation_stop(
  uuid, text, uuid[], integer
) SECURITY INVOKER;

-- This table was created after default table privileges became opt-in. Restore
-- only the CRUD surface expected by the administrative Supabase client.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.savings_goal_plan_withdrawal
  TO service_role;
