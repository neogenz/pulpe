-- pulpe:migration-phase expand
-- Mon patrimoine: an asset can hide the value its checked prévisions propose.
--
-- `suggestion_dismissed_at` is the instant the user dismissed a suggestion.
-- The suggestion is computed on read from the prévisions checked after the
-- later of the latest snapshot and this instant, so a dismissed movement is
-- never counted again. Nullable, no default: nothing deployed reads it yet.

ALTER TABLE public.asset ADD COLUMN suggestion_dismissed_at timestamptz;
