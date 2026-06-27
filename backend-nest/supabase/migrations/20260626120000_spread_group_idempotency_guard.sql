-- PUL-17: make the additive create spread (POST /budget-lines/spread) retry-safe.
-- The sourceless additive flow has no source DELETE to serialize on, so a retry
-- after a post-commit failure (e.g. a recalculation that threw) could insert a
-- SECOND group sharing the same intent. The fix: treat the client-supplied
-- spread_group_id as an idempotency key and guard against a duplicate group.
--
--   1. pg_advisory_xact_lock keyed on the group id serializes concurrent calls
--      that reuse the same key (different keys never contend) — closes the
--      check-then-insert race without a UNIQUE constraint (impossible: a group is
--      N rows sharing one id).
--   2. The EXISTS guard RAISEs 'Spread group already exists' so the application
--      can REPLAY (return the existing lines) instead of duplicating the group.
--
-- Source-backed flows pass a fresh server-generated id → the guard never trips
-- for them; they stay serialized by the existing source-consumption DELETE.

CREATE OR REPLACE FUNCTION public.create_budget_lines_spread(
  p_spread_group_id uuid,
  p_lines jsonb DEFAULT '[]'::jsonb,
  p_source_budget_line_id uuid DEFAULT NULL,
  p_source_transaction_id uuid DEFAULT NULL
) RETURNS SETOF public.budget_line
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_deleted_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency guard (PUL-17). Serialize same-key callers, then reject a group
  -- that already exists so a retry replays instead of inserting a duplicate. The
  -- advisory lock is namespaced to this function and released at transaction end.
  PERFORM pg_advisory_xact_lock(
    hashtext('create_budget_lines_spread'),
    hashtext(p_spread_group_id::text)
  );
  IF EXISTS (
    SELECT 1 FROM public.budget_line WHERE spread_group_id = p_spread_group_id
  ) THEN
    RAISE EXCEPTION 'Spread group already exists' USING ERRCODE = 'P0001';
  END IF;

  IF num_nonnulls(p_source_budget_line_id, p_source_transaction_id) > 1 THEN
    RAISE EXCEPTION 'Exactly one spread source type is allowed'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_lines) AS l(budget_id uuid)
    LEFT JOIN public.monthly_budget mb
      ON mb.id = l.budget_id AND mb.user_id = v_uid
    WHERE mb.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Budget access denied' USING ERRCODE = 'P0001';
  END IF;

  -- Defense in depth: a source-backed spread with no target lines would delete
  -- the source then insert nothing. The use case guards this; the RPC must too.
  IF num_nonnulls(p_source_budget_line_id, p_source_transaction_id) = 1
     AND jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Spread source provided with no target lines'
      USING ERRCODE = 'P0001';
  END IF;

  -- Consume the source before INSERT. Concurrent calls serialize on DELETE;
  -- only the first can observe ROW_COUNT = 1 and proceed to the fan-out.
  IF p_source_budget_line_id IS NOT NULL THEN
    DELETE FROM public.budget_line bl
    WHERE bl.id = p_source_budget_line_id
      AND EXISTS (
        SELECT 1
        FROM public.monthly_budget mb
        WHERE mb.id = bl.budget_id AND mb.user_id = v_uid
      );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    IF v_deleted_count <> 1 THEN
      RAISE EXCEPTION 'Spread source unavailable' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_source_transaction_id IS NOT NULL THEN
    DELETE FROM public.transaction t
    WHERE t.id = p_source_transaction_id
      AND EXISTS (
        SELECT 1
        FROM public.monthly_budget mb
        WHERE mb.id = t.budget_id AND mb.user_id = v_uid
      );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    IF v_deleted_count <> 1 THEN
      RAISE EXCEPTION 'Spread source unavailable' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN QUERY
  INSERT INTO public.budget_line (
    budget_id,
    name,
    amount,
    kind,
    recurrence,
    spread_group_id,
    savings_goal_id,
    original_amount,
    original_currency,
    target_currency,
    exchange_rate,
    is_manually_adjusted,
    created_at,
    updated_at
  )
  SELECT
    l.budget_id,
    l.name,
    l.amount,
    l.kind::public.transaction_kind,
    l.recurrence::public.transaction_recurrence,
    p_spread_group_id,
    l.savings_goal_id,
    l.original_amount,
    l.original_currency,
    l.target_currency,
    CASE
      WHEN l.exchange_rate IS NULL OR l.exchange_rate = '' THEN NULL
      ELSE l.exchange_rate::numeric
    END,
    false,
    NOW(),
    NOW()
  FROM jsonb_to_recordset(p_lines) AS l(
    budget_id uuid,
    name text,
    amount text,
    kind text,
    recurrence text,
    savings_goal_id uuid,
    original_amount text,
    original_currency text,
    target_currency text,
    exchange_rate text
  )
  RETURNING *;
END;
$$;

ALTER FUNCTION public.create_budget_lines_spread(uuid, jsonb, uuid, uuid)
  OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.create_budget_lines_spread(uuid, jsonb, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_budget_lines_spread(uuid, jsonb, uuid, uuid)
  TO authenticated, service_role;
