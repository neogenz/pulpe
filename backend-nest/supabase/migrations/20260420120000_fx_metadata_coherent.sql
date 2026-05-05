-- Enforce FX metadata coherence across budget_line, transaction, template_line.
-- Invariant: FX metadata is all-or-nothing AND consistent with target_currency.
-- Three valid states per row:
--   1. target_currency NULL AND all FX source fields NULL (no multi-currency context)
--   2. target_currency present AND no FX override (implicit same-currency display)
--   3. target_currency present AND full FX override (original_* fields all set AND
--      original_currency <> target_currency)
--
-- Orphan rows (violating the invariant) get cleaned up first: the 3 source FX
-- fields are force-nulled, target_currency is preserved (budget display currency).
--
-- Note: original_amount is AES-256-GCM ciphertext. The predicate only compares
-- original_currency vs target_currency (ISO codes, not encrypted) — safe.
--
-- Single transaction = atomic: if any VALIDATE fails, everything rolls back,
-- no half-fixed state in production.
--
-- ⚠️ DEPLOY ORDER CRITICAL ⚠️
-- 1. Deploy the new backend binary first (currency.service.ts fix must be live)
-- 2. Wait for rolling deploy to complete (all pods on new version)
-- 3. THEN apply this migration
-- Running this BEFORE the backend deploy causes transient 500s on UPDATE
-- because old pods can write orphan FX that the new CHECK constraint rejects.

BEGIN;

-- 1. Backfill: clean orphan rows (predicate = inverse of CHECK below)
UPDATE budget_line
SET original_amount = NULL, original_currency = NULL, exchange_rate = NULL
WHERE NOT (
  (target_currency IS NULL AND original_amount IS NULL
     AND original_currency IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NULL
      AND original_amount IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NOT NULL
      AND original_amount IS NOT NULL AND exchange_rate IS NOT NULL
      AND original_currency <> target_currency)
);

UPDATE transaction
SET original_amount = NULL, original_currency = NULL, exchange_rate = NULL
WHERE NOT (
  (target_currency IS NULL AND original_amount IS NULL
     AND original_currency IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NULL
      AND original_amount IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NOT NULL
      AND original_amount IS NOT NULL AND exchange_rate IS NOT NULL
      AND original_currency <> target_currency)
);

UPDATE template_line
SET original_amount = NULL, original_currency = NULL, exchange_rate = NULL
WHERE NOT (
  (target_currency IS NULL AND original_amount IS NULL
     AND original_currency IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NULL
      AND original_amount IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NOT NULL
      AND original_amount IS NOT NULL AND exchange_rate IS NOT NULL
      AND original_currency <> target_currency)
);

-- 2. Add CHECK constraints atomically with backfill: if VALIDATE fails on any
--    table, the entire transaction rolls back — no half-applied state. Two-phase
--    (NOT VALID + VALIDATE) inside a single transaction still holds locks for
--    both phases, so this is about atomicity, not deploy speed. On Pulpe scale,
--    lock time is acceptable (seconds to low minutes).
ALTER TABLE budget_line ADD CONSTRAINT fx_metadata_coherent
CHECK (
  (target_currency IS NULL AND original_amount IS NULL
     AND original_currency IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NULL
      AND original_amount IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NOT NULL
      AND original_amount IS NOT NULL AND exchange_rate IS NOT NULL
      AND original_currency <> target_currency)
) NOT VALID;

ALTER TABLE transaction ADD CONSTRAINT fx_metadata_coherent
CHECK (
  (target_currency IS NULL AND original_amount IS NULL
     AND original_currency IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NULL
      AND original_amount IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NOT NULL
      AND original_amount IS NOT NULL AND exchange_rate IS NOT NULL
      AND original_currency <> target_currency)
) NOT VALID;

ALTER TABLE template_line ADD CONSTRAINT fx_metadata_coherent
CHECK (
  (target_currency IS NULL AND original_amount IS NULL
     AND original_currency IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NULL
      AND original_amount IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NOT NULL
      AND original_amount IS NOT NULL AND exchange_rate IS NOT NULL
      AND original_currency <> target_currency)
) NOT VALID;

-- 3. Validate constraints against existing rows (backfill above guarantees all pass)
ALTER TABLE budget_line VALIDATE CONSTRAINT fx_metadata_coherent;
ALTER TABLE transaction VALIDATE CONSTRAINT fx_metadata_coherent;
ALTER TABLE template_line VALIDATE CONSTRAINT fx_metadata_coherent;

COMMIT;
