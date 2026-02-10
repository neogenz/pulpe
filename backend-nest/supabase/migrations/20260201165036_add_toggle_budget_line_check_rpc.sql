CREATE OR REPLACE FUNCTION public.toggle_budget_line_check(
  p_budget_line_id uuid
) RETURNS public.budget_line
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_current_checked_at timestamptz;
  v_new_checked_at timestamptz;
  v_result public.budget_line;
BEGIN
  -- Get current checked_at to determine toggle direction
  -- Ownership verified via monthly_budget.user_id (same as RLS policy)
  -- FOR UPDATE locks the row to prevent concurrent toggle race conditions
  SELECT bl.checked_at INTO v_current_checked_at
  FROM public.budget_line bl
  JOIN public.monthly_budget mb ON mb.id = bl.budget_id
  WHERE bl.id = p_budget_line_id
    AND mb.user_id = auth.uid()
  FOR UPDATE OF bl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget line not found or access denied';
  END IF;

  -- Toggle: if checked → uncheck (NULL), if unchecked → check (now)
  IF v_current_checked_at IS NOT NULL THEN
    v_new_checked_at := NULL;
  ELSE
    v_new_checked_at := v_now;
  END IF;

  -- Update budget line
  UPDATE public.budget_line
  SET checked_at = v_new_checked_at,
      updated_at = v_now
  WHERE id = p_budget_line_id;

  -- Cascade to all allocated transactions
  UPDATE public.transaction
  SET checked_at = v_new_checked_at,
      updated_at = v_now
  WHERE budget_line_id = p_budget_line_id;

  -- Return updated budget line
  SELECT * INTO v_result
  FROM public.budget_line
  WHERE id = p_budget_line_id;

  RETURN v_result;
END;
$$;
