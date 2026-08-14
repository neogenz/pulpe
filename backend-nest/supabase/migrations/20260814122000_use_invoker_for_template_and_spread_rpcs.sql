-- Existing owner-scoped policies cover every table touched by these atomic
-- template and spread operations; invoker mode keeps the transaction intact.

ALTER FUNCTION public.apply_template_line_operations(
  uuid, uuid[], uuid[], jsonb, jsonb
) SECURITY INVOKER;
ALTER FUNCTION public.create_template_with_lines(
  uuid, text, text, boolean, jsonb
) SECURITY INVOKER;
ALTER FUNCTION public.create_budget_lines_spread(
  uuid, jsonb, uuid, uuid
) SECURITY INVOKER;
