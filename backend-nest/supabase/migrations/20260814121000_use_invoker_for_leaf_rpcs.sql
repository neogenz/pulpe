-- These leaf RPCs operate only on rows already covered by owner-scoped RLS.

ALTER FUNCTION public.check_unchecked_transactions(uuid) SECURITY INVOKER;
ALTER FUNCTION public.toggle_budget_line_check(uuid) SECURITY INVOKER;
ALTER FUNCTION public.toggle_transaction_check(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_savings_goal_deletion_impact(uuid) SECURITY INVOKER;
