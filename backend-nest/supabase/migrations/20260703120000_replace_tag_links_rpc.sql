-- PUL-18: atomic replace-set for tag links. The app-level DELETE + INSERT pair
-- could commit the delete then fail the insert (tag deleted concurrently, or a
-- foreign tag id), leaving the parent row with zero tags. plpgsql runs in a
-- single transaction: any insert failure rolls back the delete too.
--
-- SECURITY INVOKER (default): RLS on transaction_tag / budget_line_tag applies
-- as if the statements ran directly — a foreign parent or foreign tag id
-- surfaces as 42501 (RLS WITH CHECK), a deleted tag as 23503 (FK), the same
-- SQLSTATEs the API already maps to ERR_TAG_NOT_FOUND.

CREATE OR REPLACE FUNCTION public.replace_transaction_tags(
  p_transaction_id uuid,
  p_tag_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM transaction_tag
  WHERE transaction_id = p_transaction_id;

  INSERT INTO transaction_tag (transaction_id, tag_id)
  SELECT p_transaction_id, tag_id
  FROM unnest(p_tag_ids) AS tag_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_transaction_tags(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_transaction_tags(uuid, uuid[])
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.replace_budget_line_tags(
  p_budget_line_id uuid,
  p_tag_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM budget_line_tag
  WHERE budget_line_id = p_budget_line_id;

  INSERT INTO budget_line_tag (budget_line_id, tag_id)
  SELECT p_budget_line_id, tag_id
  FROM unnest(p_tag_ids) AS tag_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_budget_line_tags(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_budget_line_tags(uuid, uuid[])
  TO authenticated, service_role;
