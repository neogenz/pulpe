-- pulpe:migration-phase expand
-- PUL-25: a Réel created from a bank export keeps a stable fingerprint of the
-- bank operation it came from, so importing the same export twice never
-- creates the operation twice.
--
-- The fingerprint is an HMAC-SHA256 (hex) computed by the API with a per-user
-- key derived from the server master key: it never holds the amount, the
-- label or the date in clear, and the same bank operation yields different
-- values for two users. Manual entries keep it NULL.

ALTER TABLE public.transaction
  ADD COLUMN import_fingerprint text;

ALTER TABLE public.transaction
  ADD CONSTRAINT transaction_import_fingerprint_format
  CHECK (import_fingerprint IS NULL OR import_fingerprint ~ '^[0-9a-f]{64}$')
  NOT VALID;

-- Per-user keys make fingerprints unique across all users, so one partial
-- index both answers "already imported?" and makes a racing second import
-- fail as a whole instead of duplicating rows.
CREATE UNIQUE INDEX transaction_import_fingerprint_key
  ON public.transaction (import_fingerprint)
  WHERE import_fingerprint IS NOT NULL;

COMMENT ON COLUMN public.transaction.import_fingerprint IS
  'PUL-25: HMAC-SHA256 hex of the bank operation identity (per-user server key). NULL for manual entries.';
