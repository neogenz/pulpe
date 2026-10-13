-- pulpe:migration-phase contract
-- pulpe:safe-after v0.51.1
-- PUL-25: an operation imported once is never imported again, even after its
-- Réel is spread, postponed or deleted. `transaction.import_fingerprint` dies
-- with its Réel (a spread hard-deletes its source), so "already imported?"
-- moves to a ledger that outlives the Réel. Deleting the monthly budget that
-- holds a ledger row releases it.
--
-- Contract only because the API grants are revoked below, which the expand
-- checker refuses; nothing deployed reads the ledger yet.

CREATE TABLE public.transaction_import_fingerprint (
  fingerprint text PRIMARY KEY CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  budget_id uuid NOT NULL
    REFERENCES public.monthly_budget(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX transaction_import_fingerprint_budget_id_idx
  ON public.transaction_import_fingerprint (budget_id);

ALTER TABLE public.transaction_import_fingerprint ENABLE ROW LEVEL SECURITY;

-- Written only by the trigger below and released only by the budget cascade:
-- the API reads its own rows and never writes them.
REVOKE ALL ON public.transaction_import_fingerprint FROM anon, authenticated;
GRANT SELECT ON public.transaction_import_fingerprint TO authenticated;

CREATE POLICY "Users can view own import fingerprints"
  ON public.transaction_import_fingerprint
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.monthly_budget mb
      WHERE mb.id = transaction_import_fingerprint.budget_id
        AND mb.user_id = (SELECT auth.uid())
    )
  );

-- Runs inside the import's INSERT statement, so a Réel never lands without its
-- ledger row, and a fingerprint already recorded fails the whole import with
-- 23505 like the unique index on `transaction`. The row follows a postponed
-- Réel: deleting the month it left must not release an operation that still
-- has a Réel elsewhere. Matching OLD.budget_id, which RLS has proven to be the
-- caller's, keeps an UPDATE from moving another account's row.
CREATE OR REPLACE FUNCTION public.record_transaction_import_fingerprint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transaction_import_fingerprint (fingerprint, budget_id)
    VALUES (NEW.import_fingerprint, NEW.budget_id);
  ELSE
    UPDATE public.transaction_import_fingerprint
    SET budget_id = NEW.budget_id
    WHERE fingerprint = NEW.import_fingerprint
      AND budget_id = OLD.budget_id;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.record_transaction_import_fingerprint() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_transaction_import_fingerprint()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER record_transaction_import_fingerprint
  AFTER INSERT OR UPDATE OF budget_id ON public.transaction
  FOR EACH ROW
  WHEN (NEW.import_fingerprint IS NOT NULL)
  EXECUTE FUNCTION public.record_transaction_import_fingerprint();

INSERT INTO public.transaction_import_fingerprint (fingerprint, budget_id, created_at)
SELECT import_fingerprint, budget_id, created_at
FROM public.transaction
WHERE import_fingerprint IS NOT NULL;
