-- PUL-17 — Fan-out atomique d'une dépense lissée (Lot A).
--
-- Insère N prévisions `one_off` SŒURS (une par mois) partageant un même
-- spread_group_id, en UNE seule instruction SET-BASED `INSERT … SELECT FROM
-- jsonb_to_recordset(...)` (PAS de FOR-LOOP par ligne) → tout-ou-rien dans la
-- transaction implicite de la fonction.
--
-- Sécurité (calquée sur apply_template_line_operations / create_template_with_lines,
-- PUL-272) : SECURITY DEFINER bypasse RLS, donc l'appartenance est vérifiée
-- explicitement — CHAQUE budget_id cible doit appartenir à l'appelant, sinon
-- un utilisateur authentifié pourrait injecter des lignes dans le budget d'un
-- tiers via PostgREST direct (IDOR). REVOKE PUBLIC/anon en ceinture-bretelles.
--
-- `amount` / `original_amount` sont des ciphertexts AES-256-GCM produits par
-- ENCRYPTION_PORT côté repo (la fonction les stocke tels quels, aucun
-- (dé)chiffrement en SQL). `spread_group_id` est un uuid NON financier, jamais
-- chiffré. L'auto-création des budgets manquants se fait HORS de cette fonction
-- (txns courtes séparées), de sorte que ce fan-out reste une transaction courte.

CREATE OR REPLACE FUNCTION public.create_budget_lines_spread(
  p_spread_group_id uuid,
  p_lines jsonb DEFAULT '[]'::jsonb
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
END;
$$;

ALTER FUNCTION public.create_budget_lines_spread(uuid, jsonb) OWNER TO postgres;

-- Belt-and-suspenders on top of the in-body ownership guard (PUL-272 pattern).
REVOKE EXECUTE ON FUNCTION public.create_budget_lines_spread(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_budget_lines_spread(uuid, jsonb) TO authenticated, service_role;
