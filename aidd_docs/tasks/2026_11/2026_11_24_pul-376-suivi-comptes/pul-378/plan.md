---
objective: "Chaque mouvement du budget (prévision, imprévu, ligne de modèle) peut porter un compte de « Mon patrimoine », prérempli par un compte par défaut, et la valeur de ce compte suit ce qui est pointé selon la règle du solde pointé, sur le serveur, le web et iOS."
status: pending
---

# Plan: PUL-378 — rattacher un mouvement à un compte, avec un compte par défaut

Source: Linear PUL-378 ([contract.md](./contract.md)), epic PUL-376 ([../epic.md](../epic.md)), après PUL-377 ([../pul-377/plan.md](../pul-377/plan.md))

## Phases

| #   | Phase                                                        | File                         | Depends on |
| --- | ------------------------------------------------------------ | ---------------------------- | ---------- |
| 1   | Serveur : le lien « Compte » et la valeur qu'il fait bouger   | [`phase-1.md`](./phase-1.md) | none       |
| 2   | Serveur : écrire le compte sur un mouvement                   | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | Serveur : modèle, propagation et lissage portent le compte    | [`phase-3.md`](./phase-3.md) | 2          |
| 4   | Serveur : compte par défaut                                   | [`phase-4.md`](./phase-4.md) | 2          |
| 5   | Web : champ « Compte » dans les formulaires                   | [`phase-5.md`](./phase-5.md) | 3, 4       |
| 6   | Web : réglage « Compte par défaut », menu et badge            | [`phase-6.md`](./phase-6.md) | 4, 5       |
| 7   | iOS : champ « Compte » dans les formulaires                   | [`phase-7.md`](./phase-7.md) | 3, 4       |
| 8   | iOS : réglage « Compte par défaut », menu et badge            | [`phase-8.md`](./phase-8.md) | 4, 7       |

## External sources

| URL  | What it settled |
| ---- | --------------- |
| none | none            |

## Impact

| Category      | Verdict and evidence | Handled in |
| ------------- | -------------------- | ---------- |
| runtime       | Aucune dépendance externe nouvelle. Quatre migrations contract (`safe-after v0.66.2`, dernier tag publié) appliquées avant le backend ; le backend publié ignore `account_id` (lectures `*`, RPC à clé absente = inchangé). Ordre « trigger BEFORE DELETE puis action `ON DELETE SET NULL` » non vérifié sur la doc PostgreSQL : prouvé par le test SQL de la phase 1. | 1, 2, 3, 4 |
| regression    | Un lien existant (`asset_id`) compte désormais selon le solde pointé (max(montant, réels pointés)) au lieu du montant prévu : règle voulue du ticket. Les cas 377 sans réel gardent leurs chiffres (`asset.formulas.spec.ts`). | 1 |
| regression    | Neuf RPC réécrites à partir de la base (risque moyen). Filets existants : `apply_template_line_operations_*.sql`, `create_budget_from_template_owner_only.sql`, `create_budget_lines_spread_source_consumption.sql`, `savings_goal_withdrawal_atomicity.sql`, `planned_savings_goal_withdrawals.sql`, `security_definer_function_privileges.sql` (impose DEFINER + verrou sur les RPC de retrait). Pas de phase filet : ces suites tournent déjà en CI. | 2, 3 |
| regression    | iOS 1.14.x et Android : schémas de mise à jour inchangés pour eux (champ optionnel absent = gardé) ; réponses enrichies de `accountId`, `defaultAccountId` (clients `z.object` / `decodeIfPresent`). | 2, 3, 4 |
| architecture  | `transaction`, `budget-line`, `transaction-import` lisent le compte par défaut via `USER_REPOSITORY` (déjà exporté, déjà lu par `asset` et `savings-goal`). Le calcul reste dans `asset.formulas.ts` ; aucune formule de `shared/src/calculators` ne change, donc pas de miroir iOS. | 1, 4 |
| documentation | `docs/BUSINESS_RULES.md` § Patrimoine (solde pointé, lien « Compte », compte par défaut) ; `backend-nest/supabase/tests/README.md` (nouvelles suites). | 1, 2, 3, 4 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `.claude/rules/05-workflows-and-processes/api-contract-changes.md` | Champs ajoutés aux requêtes et réponses de quatre ressources ; apps installées sans mise à jour. |
| `docs/DEPLOYMENT.md` (en-têtes `pulpe:migration-phase` / `safe-after`) | Quatre migrations avec FK inline et REVOKE : contract. |
| `.claude/rules/03-frameworks-and-libraries/supabase.md` (RPC JSONB → Zod strict) | Les payloads de lissage, modèle et retrait portent des chiffrés et gagnent `account_id`. |
| `.claude/rules/05-workflows-and-processes/encryption-backend.md` | La lecture des mouvements déchiffre dans le repository, en strict, sans journaliser de montant. |
| `CLAUDE.md` miroir de formules | Non déclenché : seul `asset.formulas.ts` (backend) change. |
| `CLAUDE.md` lexique (`pnpm test:lexicon`) | Libellés « Compte », « Mouvements », jamais « transaction » à l'écran. |

## Decisions

| Decision | Why |
| -------- | --- |
| Colonne `account_id` (FK `asset` `ON DELETE SET NULL`) sur `budget_line`, `template_line`, `transaction` ; garde `enforce_account_link` (propriétaire seulement, archivé accepté) ; `CHECK (account_id <> asset_id)`. | Second lien distinct d'`asset_id`, dans les deux sens ; CA24, CA25 au plus près des données. |
| Un mouvement rattaché à une prévision ne porte jamais de compte ; un trigger `BEFORE DELETE` sur `budget_line` copie le compte aux mouvements libérés. | CA4 et CA46 dans la même écriture, pour tous les chemins de suppression (prévision, propagation, lissage). |
| Lecture par une fonction invoker `list_asset_movements(p_since)` qui rend des chiffrés ; formule en événements datés par prévision. | Bornée à ce qui a bougé depuis la plus ancienne saisie, un aller-retour, CA15 exact, ordre de pointage pour les dettes. |
| Compte par défaut dans `user_default_account` (FK composite `CASCADE` + trigger d'archivage), exposé par `/v1/users/settings`. | CA35 sans code applicatif ni écriture service-role ; lecture sans appel Supabase Auth à chaque création. |
| Le serveur applique le défaut seulement quand `accountId` est absent à la création ; web et iOS récents envoient toujours le champ. | CA32 pour Android, anciennes apps, import, assistant ; CA44 par un `null` explicite. |
