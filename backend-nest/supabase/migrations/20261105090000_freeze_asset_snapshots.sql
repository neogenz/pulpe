-- pulpe:migration-phase contract
-- pulpe:safe-after v0.59.0
-- Mon patrimoine: a snapshot is a dated value, written once.
--
-- The API only inserts and deletes snapshots; the rekey rewrites them as
-- SECURITY DEFINER, outside these grants. The UPDATE grant only let a PATCH
-- sent straight to PostgREST store a value the backend cannot decrypt, which
-- then failed every `GET /assets` for that user. Contract only because it
-- revokes a grant.

DROP POLICY "Users can update own asset snapshots" ON public.asset_snapshot;
REVOKE UPDATE ON public.asset_snapshot FROM authenticated;
