-- pulpe:migration-phase contract
-- pulpe:safe-after v0.59.0
-- Mon patrimoine: the database dates a dismissed suggestion.
--
-- The suggestion counts the prévisions checked after the later of the last
-- snapshot and the dismissal. Snapshots take `now()` from the database; a
-- dismissal dated by the API host could land a few seconds off and hide or
-- recount a line checked around that instant. Whatever value a write sends,
-- a new dismissal now takes the database clock.

CREATE OR REPLACE FUNCTION public.stamp_asset_suggestion_dismissal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.suggestion_dismissed_at IS NOT NULL
    AND NEW.suggestion_dismissed_at IS DISTINCT FROM OLD.suggestion_dismissed_at
  THEN
    NEW.suggestion_dismissed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_asset_suggestion_dismissal()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER stamp_asset_suggestion_dismissal
  BEFORE UPDATE OF suggestion_dismissed_at ON public.asset
  FOR EACH ROW EXECUTE FUNCTION public.stamp_asset_suggestion_dismissal();
