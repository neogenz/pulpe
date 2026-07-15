-- PUL-18 + PUL-12: compose the hardened scalar/savings-goal bulk RPC and the
-- tag propagation RPC inside one outer PostgreSQL transaction. Any uncaught
-- error in either function rolls back template lines, budget lines and links.

CREATE OR REPLACE FUNCTION public.apply_template_line_operations_with_tags(
  p_template_id uuid,
  p_budget_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_delete_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_updated_lines jsonb DEFAULT '[]'::jsonb,
  p_created_lines jsonb DEFAULT '[]'::jsonb,
  p_line_tag_pairs jsonb DEFAULT '[]'::jsonb
) RETURNS uuid[]
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  affected_budget_ids uuid[];
BEGIN
  affected_budget_ids := public.apply_template_line_operations(
    template_id => p_template_id,
    budget_ids => COALESCE(p_budget_ids, ARRAY[]::uuid[]),
    delete_ids => COALESCE(p_delete_ids, ARRAY[]::uuid[]),
    updated_lines => COALESCE(p_updated_lines, '[]'::jsonb),
    created_lines => COALESCE(p_created_lines, '[]'::jsonb)
  );

  PERFORM public.bulk_replace_template_line_tags_and_sync(
    COALESCE(p_line_tag_pairs, '[]'::jsonb),
    COALESCE(p_budget_ids, ARRAY[]::uuid[])
  );

  RETURN affected_budget_ids;
END;
$$;

ALTER FUNCTION public.apply_template_line_operations_with_tags(
  uuid, uuid[], uuid[], jsonb, jsonb, jsonb
) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.apply_template_line_operations_with_tags(
  uuid, uuid[], uuid[], jsonb, jsonb, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_template_line_operations_with_tags(
  uuid, uuid[], uuid[], jsonb, jsonb, jsonb
) TO authenticated, service_role;
