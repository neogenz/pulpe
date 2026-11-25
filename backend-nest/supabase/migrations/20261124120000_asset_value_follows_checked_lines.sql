-- pulpe:migration-phase contract
-- pulpe:safe-after v0.66.2
-- Mon patrimoine (PUL-377): the value of an asset is its last entry plus what
-- was checked since. There is no suggestion left to apply or dismiss.
--
-- A dismissed suggestion must not come back: the old backend forgot the
-- movements checked before `suggestion_dismissed_at`, the new one only reads
-- the last snapshot. For each asset dismissed after its last snapshot, that
-- snapshot is copied (same ciphertext, no amount in clear) and dated from the
-- dismissal, so the new value starts from it.
--
-- 1. The trigger does the copy for every dismissal the old backend still
--    writes between this migration and the switch to the new backend (and
--    for the installed apps, until that backend is gone). The new backend
--    never writes the column, so the trigger then stays idle.
-- 2. The same copy for the dismissals already stored. Idempotent: once
--    copied, the last snapshot is no longer older than the dismissal.
--
-- Contract only because the expand checker refuses the REVOKE on the trigger
-- function; nothing deployed depends on its absence.

CREATE OR REPLACE FUNCTION public.snapshot_dismissed_asset_suggestion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  -- Invoker rights: the snapshot RLS lets the owner insert their own row.
  INSERT INTO public.asset_snapshot (user_id, asset_id, value, recorded_at)
  SELECT NEW.user_id, NEW.id, latest.value, NEW.suggestion_dismissed_at
  FROM public.asset_latest_snapshot latest
  WHERE latest.asset_id = NEW.id
    AND latest.recorded_at < NEW.suggestion_dismissed_at;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_dismissed_asset_suggestion()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER snapshot_dismissed_asset_suggestion
  AFTER UPDATE OF suggestion_dismissed_at ON public.asset
  FOR EACH ROW
  WHEN (
    NEW.suggestion_dismissed_at IS NOT NULL
    AND NEW.suggestion_dismissed_at IS DISTINCT FROM OLD.suggestion_dismissed_at
  )
  EXECUTE FUNCTION public.snapshot_dismissed_asset_suggestion();

INSERT INTO public.asset_snapshot (user_id, asset_id, value, recorded_at)
SELECT a.user_id, a.id, latest.value, a.suggestion_dismissed_at
FROM public.asset a
JOIN public.asset_latest_snapshot latest ON latest.asset_id = a.id
WHERE a.suggestion_dismissed_at IS NOT NULL
  AND latest.recorded_at < a.suggestion_dismissed_at;
