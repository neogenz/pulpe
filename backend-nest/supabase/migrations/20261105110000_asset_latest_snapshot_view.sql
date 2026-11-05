-- pulpe:migration-phase expand
-- Mon patrimoine: read the current value of each asset without its history.
--
-- `GET /assets` paged the user's whole snapshot history to keep the newest row
-- per asset. The view hands back that row alone, served by
-- `asset_snapshot_asset_id_recorded_at_idx`. Invoker rights, so the snapshot
-- RLS still decides what a user sees.

CREATE OR REPLACE VIEW public.asset_latest_snapshot
WITH (security_invoker = true) AS
SELECT DISTINCT ON (asset_id) asset_id, user_id, value, recorded_at
FROM public.asset_snapshot
ORDER BY asset_id, recorded_at DESC, id;

REVOKE ALL ON public.asset_latest_snapshot FROM anon;
GRANT SELECT ON public.asset_latest_snapshot TO authenticated;
