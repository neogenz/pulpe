CREATE OR REPLACE FUNCTION public.check_unchecked_transactions(
  p_budget_line_id uuid
) RETURNS SETOF public.transaction
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.budget_line bl
    JOIN public.monthly_budget mb ON mb.id = bl.budget_id
    WHERE bl.id = p_budget_line_id
      AND mb.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Budget line not found or access denied';
  END IF;

  RETURN QUERY
  UPDATE public.transaction
  SET checked_at = v_now, updated_at = v_now
  WHERE budget_line_id = p_budget_line_id
    AND checked_at IS NULL
  RETURNING *;
END;
$$;
