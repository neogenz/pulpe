-- PUL-17 — Lissage d'une dépense sur plusieurs mois
-- Clé de groupe des N prévisions `one_off` sœurs réparties sur plusieurs mois
-- (interprétation B : chaque mois est une budget_line indépendante).
-- uuid NON financier → JAMAIS chiffré (contrairement à amount / original_amount).
-- Nullable + additif → backward-compatible avec les lignes existantes (NULL = non lissée).

ALTER TABLE budget_line ADD COLUMN spread_group_id uuid;

-- Index PARTIEL : les lignes lissées sont une fraction infime du total.
-- Couvre le read cross-mois du Lot C (WHERE spread_group_id = $1, égalité simple) ;
-- 5-20× plus petit qu'un index complet, writes moins chers sur les ~99% non-lissées.
-- Pas d'index de join redondant (idx_budget_line_budget_id + PK monthly_budget suffisent),
-- aucune modif RLS (policy SELECT déjà perf-optimale, auth.uid() mis en cache).
CREATE INDEX idx_budget_line_spread_group_id
  ON budget_line (spread_group_id)
  WHERE spread_group_id IS NOT NULL;
