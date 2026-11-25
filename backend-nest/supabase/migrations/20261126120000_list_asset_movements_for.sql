-- pulpe:migration-phase contract
-- pulpe:safe-after v0.66.2
-- Mon patrimoine (PUL-379): the read behind both the value of an asset and its
-- history. Same selection as `list_asset_movements` (PUL-378), plus the name
-- of each movement, shown in the history, and an optional asset: given, only
-- what can move that asset is returned.
--
-- A new function rather than a new signature of `list_asset_movements`: a
-- published migration is never edited, a different return type needs a DROP,
-- and a PUL-378 backend still deployed calls the old one. Contract only for
-- the REVOKE, which the expand checker refuses.

-- The caller's movements that can move an asset after `p_since`, amounts still
-- encrypted:
--   'line' a prévision linked by `account_id` or `asset_id` (to `p_asset_id`
--          when given), checked after `p_since` or holding a movement checked
--          after it;
--   'real' every checked movement of those prévisions, before `p_since`
--          included: the value counts what a prévision counts now minus what
--          it counted at the last entry;
--   'free' a movement outside any prévision, with an account (`p_asset_id`
--          when given), checked after `p_since`.
-- Invoker rights: RLS limits every row to the caller.
CREATE OR REPLACE FUNCTION public.list_asset_movements_for(
  p_since timestamptz,
  p_asset_id uuid DEFAULT NULL
)
RETURNS TABLE (
  movement text,
  id uuid,
  budget_line_id uuid,
  kind public.transaction_kind,
  amount text,
  checked_at timestamptz,
  account_id uuid,
  asset_id uuid,
  name text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  WITH own_budget AS (
    SELECT mb.id
    FROM public.monthly_budget mb
    WHERE mb.user_id = (SELECT auth.uid())
  ),
  linked_line AS (
    SELECT bl.id, bl.kind, bl.amount, bl.checked_at, bl.account_id,
           bl.asset_id, bl.name
    FROM public.budget_line bl
    JOIN own_budget ob ON ob.id = bl.budget_id
    WHERE (bl.account_id IS NOT NULL OR bl.asset_id IS NOT NULL)
      AND (
        p_asset_id IS NULL
        OR bl.account_id = p_asset_id
        OR bl.asset_id = p_asset_id
      )
      AND (
        bl.checked_at > p_since
        OR EXISTS (
          SELECT 1
          FROM public.transaction t
          WHERE t.budget_line_id = bl.id
            AND t.checked_at > p_since
        )
      )
  )
  SELECT 'line', l.id, NULL::uuid, l.kind, l.amount, l.checked_at,
         l.account_id, l.asset_id, l.name
  FROM linked_line l
  UNION ALL
  SELECT 'real', t.id, t.budget_line_id, t.kind, t.amount, t.checked_at,
         NULL::uuid, NULL::uuid, t.name
  FROM public.transaction t
  JOIN linked_line l ON l.id = t.budget_line_id
  WHERE t.checked_at IS NOT NULL
  UNION ALL
  SELECT 'free', t.id, NULL::uuid, t.kind, t.amount, t.checked_at,
         t.account_id, NULL::uuid, t.name
  FROM public.transaction t
  JOIN own_budget ob ON ob.id = t.budget_id
  WHERE t.budget_line_id IS NULL
    AND t.account_id IS NOT NULL
    AND (p_asset_id IS NULL OR t.account_id = p_asset_id)
    AND t.checked_at > p_since
$$;

REVOKE ALL ON FUNCTION public.list_asset_movements_for(timestamptz, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_asset_movements_for(timestamptz, uuid)
  TO authenticated;
