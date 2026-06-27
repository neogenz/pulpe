-- PUL-17 v1.1 (Defect 2) — Fan-out + suppression de la source DANS LA MÊME
-- transaction SECURITY DEFINER.
--
-- Avant : le use-case faisait `create_budget_lines_spread()` (RPC committée) PUIS
-- un `repo.delete(source)` séparé. Si le delete échouait après un fan-out commité,
-- la base gardait la source (T sur M0) + N tranches (T/N) → M0 double-compté ; et
-- un retour client re-passait l'éligibilité (la source n'était jamais taguée) →
-- un SECOND spread_group dupliqué. Pour un RÉEL, delete-puis-fanout n'est pas un
-- repli sûr (un échec du fan-out après delete PERDRAIT l'actual).
--
-- Fix : on plie la suppression de la source dans la fonction. INSERT … SELECT
-- (les N tranches) PUIS le DELETE de la source sont tout-ou-rien. Un échec laisse
-- la source intacte + rien de créé (pas de double-compte, pas de perte d'argent) ;
-- un retour ne peut plus dupliquer car la source a disparu en cas de succès.
--
-- Paramètres source OPTIONNELS (DEFAULT NULL) :
--   - flux create additif : appelle sans source (NULLs) → comportement inchangé.
--   - flux spread-from prévision : passe p_source_budget_line_id.
--   - flux spread-from réel     : passe p_source_transaction_id.
--
-- Sécurité : SECURITY DEFINER bypasse RLS. L'appartenance des budgets cibles est
-- déjà vérifiée (guard cross-tenant existant). La source à supprimer est elle
-- aussi gardée : le DELETE ne touche la ligne QUE si son monthly_budget appartient
-- à auth.uid() (sous-requête EXISTS), sinon il n'affecte aucune ligne — pas d'IDOR.
--
-- Signature étendue (params traînants) → CREATE OR REPLACE créerait une SURCHARGE
-- (les deux versions coexisteraient, PostgREST résoudrait l'ancienne 2-arg sur un
-- appel à 2 args et NE supprimerait PAS la source). On DROP donc l'ancienne puis on
-- CREATE la nouvelle : une seule fonction, l'appel create à 2 args nommés résout
-- sans ambiguïté la nouvelle signature (les params source défaillent à NULL).

DROP FUNCTION IF EXISTS public.create_budget_lines_spread(uuid, jsonb);

CREATE FUNCTION public.create_budget_lines_spread(
  p_spread_group_id uuid,
  p_lines jsonb DEFAULT '[]'::jsonb,
  p_source_budget_line_id uuid DEFAULT NULL,
  p_source_transaction_id uuid DEFAULT NULL
) RETURNS SETOF public.budget_line
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Cross-tenant write guard : chaque budget_id ciblé par une tranche doit
  -- appartenir à l'appelant. unnest d'un tableau vide ne renvoie aucune ligne,
  -- donc le cas "0 tranche" passe sans exception (et n'insère rien).
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_lines) AS l(budget_id uuid)
    LEFT JOIN public.monthly_budget mb
      ON mb.id = l.budget_id AND mb.user_id = v_uid
    WHERE mb.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Budget access denied' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  INSERT INTO public.budget_line (
    budget_id,
    name,
    amount,
    kind,
    recurrence,
    spread_group_id,
    savings_goal_id,
    original_amount,
    original_currency,
    target_currency,
    exchange_rate,
    is_manually_adjusted,
    created_at,
    updated_at
  )
  SELECT
    l.budget_id,
    l.name,
    l.amount,
    l.kind::public.transaction_kind,
    l.recurrence::public.transaction_recurrence,
    p_spread_group_id,
    l.savings_goal_id,
    l.original_amount,
    l.original_currency,
    l.target_currency,
    CASE
      WHEN l.exchange_rate IS NULL OR l.exchange_rate = ''
      THEN NULL
      ELSE l.exchange_rate::numeric
    END,
    false,
    NOW(),
    NOW()
  FROM jsonb_to_recordset(p_lines) AS l(
    budget_id uuid,
    name text,
    amount text,
    kind text,
    recurrence text,
    savings_goal_id uuid,
    original_amount text,
    original_currency text,
    target_currency text,
    exchange_rate text
  )
  RETURNING *;

  -- Atomic source removal : same transaction as the INSERT above. Ownership-guarded
  -- (the source's monthly_budget must belong to auth.uid()) so a forged id deletes
  -- nothing — no IDOR. Optional: the additive create flow passes NULL → no-op.
  IF p_source_budget_line_id IS NOT NULL THEN
    DELETE FROM public.budget_line bl
    WHERE bl.id = p_source_budget_line_id
      AND EXISTS (
        SELECT 1 FROM public.monthly_budget mb
        WHERE mb.id = bl.budget_id AND mb.user_id = v_uid
      );
  END IF;

  IF p_source_transaction_id IS NOT NULL THEN
    DELETE FROM public.transaction t
    WHERE t.id = p_source_transaction_id
      AND EXISTS (
        SELECT 1 FROM public.monthly_budget mb
        WHERE mb.id = t.budget_id AND mb.user_id = v_uid
      );
  END IF;
END;
$$;

ALTER FUNCTION public.create_budget_lines_spread(uuid, jsonb, uuid, uuid)
  OWNER TO postgres;

-- Belt-and-suspenders on top of the in-body ownership guard (PUL-272 pattern).
REVOKE EXECUTE ON FUNCTION public.create_budget_lines_spread(uuid, jsonb, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_budget_lines_spread(uuid, jsonb, uuid, uuid)
  TO authenticated, service_role;
