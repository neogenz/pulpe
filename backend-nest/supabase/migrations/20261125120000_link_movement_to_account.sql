-- pulpe:migration-phase contract
-- pulpe:safe-after v0.66.2
-- Mon patrimoine (PUL-378): a movement of the budget (prévision, ligne de
-- modèle, mouvement réel) can name the account it leaves or reaches. This
-- link (`account_id`) is distinct from `asset_id` (the asset a prévision feeds,
-- draws from or repays) and accepts both directions, own or owe.
--
-- Contract only because the foreign keys are inline and the guard function is
-- revoked, which the expand checker refuses; nothing deployed reads or writes
-- `account_id` yet.
--
-- 1. The column on the three tables, its foreign key (deleting an asset
--    unlinks the movements, never deletes them), its index, and the CHECK that
--    keeps a prévision from naming the same asset twice.
-- 2. The guard: the account belongs to the movement's owner. No direction
--    rule; an archived account stays accepted so editing a movement that keeps
--    it does not fail.
-- 3. Deleting a prévision frees its movements (ON DELETE SET NULL on
--    `transaction.budget_line_id`); they take the prévision's account in the
--    same statement, since a movement allocated to a prévision follows its
--    account and stores none.
-- 4. The read behind the value of an asset: what moved after a given instant.

-- ---------------------------------------------------------------------------
-- 1. Column, foreign key, index, CHECK
-- ---------------------------------------------------------------------------

ALTER TABLE public.budget_line
  ADD COLUMN account_id uuid REFERENCES public.asset (id) ON DELETE SET NULL,
  ADD CONSTRAINT budget_line_account_not_asset CHECK (account_id <> asset_id);
ALTER TABLE public.template_line
  ADD COLUMN account_id uuid REFERENCES public.asset (id) ON DELETE SET NULL,
  ADD CONSTRAINT template_line_account_not_asset CHECK (account_id <> asset_id);
ALTER TABLE public.transaction
  ADD COLUMN account_id uuid REFERENCES public.asset (id) ON DELETE SET NULL;

-- Serve the ON DELETE SET NULL scan when an asset is deleted.
CREATE INDEX idx_budget_line_account_id
  ON public.budget_line (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_template_line_account_id
  ON public.template_line (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_transaction_account_id
  ON public.transaction (account_id) WHERE account_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Guard trigger
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so the owner comparison sees the asset whatever the caller's
-- RLS shows; a foreign or deleted asset is refused as 'Account access denied'.
CREATE OR REPLACE FUNCTION public.enforce_account_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME IN ('budget_line', 'transaction') THEN
    SELECT mb.user_id
    INTO v_owner_id
    FROM public.monthly_budget mb
    WHERE mb.id = NEW.budget_id;
  ELSIF TG_TABLE_NAME = 'template_line' THEN
    SELECT t.user_id
    INTO v_owner_id
    FROM public.template t
    WHERE t.id = NEW.template_id;
  ELSE
    RAISE EXCEPTION 'Unsupported account link table: %', TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.asset a
    WHERE a.id = NEW.account_id
      AND a.user_id = v_owner_id
  ) THEN
    RAISE EXCEPTION 'Account access denied'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_account_link() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_account_link()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_budget_line_account_link
  BEFORE INSERT OR UPDATE OF account_id, budget_id ON public.budget_line
  FOR EACH ROW EXECUTE FUNCTION public.enforce_account_link();
CREATE TRIGGER enforce_template_line_account_link
  BEFORE INSERT OR UPDATE OF account_id, template_id ON public.template_line
  FOR EACH ROW EXECUTE FUNCTION public.enforce_account_link();
CREATE TRIGGER enforce_transaction_account_link
  BEFORE INSERT OR UPDATE OF account_id, budget_id ON public.transaction
  FOR EACH ROW EXECUTE FUNCTION public.enforce_account_link();

-- ---------------------------------------------------------------------------
-- 3. Freed movements take the account of their deleted prévision
-- ---------------------------------------------------------------------------

-- BEFORE DELETE runs ahead of the foreign key's ON DELETE SET NULL, so the
-- movements are still attached to OLD.id here. Skipped when the account or the
-- budget is already gone (a user deletion cascading through every table).
-- Invoker rights: RLS lets the owner update their own movements.
CREATE OR REPLACE FUNCTION public.carry_account_to_freed_transactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.transaction t
  SET account_id = OLD.account_id
  WHERE t.budget_line_id = OLD.id
    AND EXISTS (
      SELECT 1
      FROM public.asset a
      JOIN public.monthly_budget mb ON mb.user_id = a.user_id
      WHERE a.id = OLD.account_id
        AND mb.id = OLD.budget_id
    );
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.carry_account_to_freed_transactions()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER carry_account_to_freed_transactions
  BEFORE DELETE ON public.budget_line
  FOR EACH ROW
  WHEN (OLD.account_id IS NOT NULL)
  EXECUTE FUNCTION public.carry_account_to_freed_transactions();

-- ---------------------------------------------------------------------------
-- 4. What moved after an instant
-- ---------------------------------------------------------------------------

-- The caller's movements that can move an asset after `p_since`, amounts still
-- encrypted:
--   'line' a prévision linked by `account_id` or `asset_id`, checked after
--          `p_since` or holding a movement checked after it;
--   'real' every checked movement of those prévisions, before `p_since`
--          included: the value counts what a prévision counts now minus what
--          it counted at the last entry;
--   'free' a movement outside any prévision, with an account, checked after
--          `p_since`.
-- Invoker rights: RLS limits every row to the caller.
CREATE OR REPLACE FUNCTION public.list_asset_movements(p_since timestamptz)
RETURNS TABLE (
  movement text,
  id uuid,
  budget_line_id uuid,
  kind public.transaction_kind,
  amount text,
  checked_at timestamptz,
  account_id uuid,
  asset_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  WITH own_budget AS (
    SELECT mb.id
    FROM public.monthly_budget mb
    WHERE mb.user_id = (SELECT auth.uid())
  ),
  linked_line AS (
    SELECT bl.id, bl.kind, bl.amount, bl.checked_at, bl.account_id, bl.asset_id
    FROM public.budget_line bl
    JOIN own_budget ob ON ob.id = bl.budget_id
    WHERE (bl.account_id IS NOT NULL OR bl.asset_id IS NOT NULL)
      AND (
        bl.checked_at > p_since
        OR EXISTS (
          SELECT 1
          FROM public.transaction t
          WHERE t.budget_line_id = bl.id
            AND t.checked_at > p_since
        )
      )
  )
  SELECT 'line', l.id, NULL::uuid, l.kind, l.amount, l.checked_at,
         l.account_id, l.asset_id
  FROM linked_line l
  UNION ALL
  SELECT 'real', t.id, t.budget_line_id, t.kind, t.amount, t.checked_at,
         NULL::uuid, NULL::uuid
  FROM public.transaction t
  JOIN linked_line l ON l.id = t.budget_line_id
  WHERE t.checked_at IS NOT NULL
  UNION ALL
  SELECT 'free', t.id, NULL::uuid, t.kind, t.amount, t.checked_at,
         t.account_id, NULL::uuid
  FROM public.transaction t
  JOIN own_budget ob ON ob.id = t.budget_id
  WHERE t.budget_line_id IS NULL
    AND t.account_id IS NOT NULL
    AND t.checked_at > p_since
$$;

REVOKE ALL ON FUNCTION public.list_asset_movements(timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_asset_movements(timestamptz)
  TO authenticated;
