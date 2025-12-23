-- RPC function to get budget lines with consumption data
-- Uses a single query with LEFT JOIN and GROUP BY to avoid N+1 queries
-- Returns budget lines enriched with consumed_amount and remaining_amount

CREATE OR REPLACE FUNCTION get_budget_lines_with_consumption(p_budget_id UUID)
RETURNS TABLE (
  id UUID,
  budget_id UUID,
  template_line_id UUID,
  savings_goal_id UUID,
  name TEXT,
  amount NUMERIC,
  kind transaction_kind,
  recurrence transaction_recurrence,
  is_manually_adjusted BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  consumed_amount NUMERIC,
  remaining_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bl.id,
    bl.budget_id,
    bl.template_line_id,
    bl.savings_goal_id,
    bl.name,
    bl.amount,
    bl.kind,
    bl.recurrence,
    bl.is_manually_adjusted,
    bl.created_at,
    bl.updated_at,
    COALESCE(SUM(t.amount), 0)::NUMERIC as consumed_amount,
    (bl.amount - COALESCE(SUM(t.amount), 0))::NUMERIC as remaining_amount
  FROM budget_line bl
  LEFT JOIN transaction t ON t.budget_line_id = bl.id
  WHERE bl.budget_id = p_budget_id
  GROUP BY bl.id
  ORDER BY bl.created_at;
END;
$$;

COMMENT ON FUNCTION get_budget_lines_with_consumption(UUID) IS
  'Returns budget lines with consumption data (consumed_amount, remaining_amount) for envelope tracking. Uses a single query with LEFT JOIN and GROUP BY for optimal performance.';
