-- pulpe:migration-phase contract
-- pulpe:safe-after v0.66.0
-- « Comparer avec mes comptes » no longer asks for, stores or counts money from
-- before Pulpe: a gap is noted like any other. Clear the amounts saved by
-- v0.66.0, which often offset what earlier months left unchecked rather than
-- real money. The column stays (the rekey functions name it) and is never
-- written again.
UPDATE public.user_reconciliation
SET starting_amount = NULL
WHERE starting_amount IS NOT NULL;
