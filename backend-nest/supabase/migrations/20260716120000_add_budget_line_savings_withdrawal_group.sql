-- PUL-292 — Piocher dans son épargne pour un mois serré, remboursement planifié
-- Clé de groupe du COUPLE : un revenu `one_off` sur le mois consulté M et une
-- épargne `one_off` sur M+1 (« Remettre sur ton épargne »), liés légèrement —
-- badge « pris sur ton épargne » + suppression groupée à choix explicite.
-- JAMAIS de synchro de montants entre les deux lignes (décision produit v1).
-- Colonne DISTINCTE de spread_group_id : la sémantique spread (pill « Lissé »,
-- endpoint occurrences, exclusion du report) ne doit pas fuir sur le couple.
-- uuid NON financier → JAMAIS chiffré (contrairement à amount / original_amount).
-- Nullable + additif → backward-compatible (NULL = ligne non liée).

ALTER TABLE budget_line ADD COLUMN savings_withdrawal_group_id uuid;

-- Index UNIQUE partiel (groupe, kind), double rôle :
-- 1. lookup du groupe (badge, suppression groupée, replay) — égalité simple ;
-- 2. garde d'idempotence : un couple = UN income + UN saving par groupe. Un POST
--    rejoué avec la même clé client (retry réseau / double-tap) viole l'index
--    (23505) et le use case REPLAYE le résultat d'origine au lieu de créer un
--    second couple — même contrat que la garde advisory-lock de PUL-17, porté
--    par une contrainte au lieu d'une RPC.
CREATE UNIQUE INDEX idx_budget_line_savings_withdrawal_group_kind
  ON budget_line (savings_withdrawal_group_id, kind)
  WHERE savings_withdrawal_group_id IS NOT NULL;
