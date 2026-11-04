-- pulpe:migration-phase contract
-- pulpe:safe-after v0.59.0
-- Mon patrimoine: the direction and the currency of an asset are fixed at
-- creation, at the database too.
--
-- The API never writes them after the insert, but the table-wide UPDATE grant
-- let a PATCH sent straight to PostgREST flip an own asset to owe: its linked
-- Épargne lines would then break the link invariant, which the trigger checks
-- only on line writes. Contract only because it revokes a grant; the API
-- shipped with this branch writes nothing outside the granted columns.

REVOKE UPDATE ON public.asset FROM authenticated;
GRANT UPDATE (category_id, name, in_pulpe, archived_at, suggestion_dismissed_at)
  ON public.asset TO authenticated;
