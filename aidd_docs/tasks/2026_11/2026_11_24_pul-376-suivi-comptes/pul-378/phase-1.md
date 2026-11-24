---
status: pending
---

# Instruction: Serveur — le lien « Compte » et la valeur qu'il fait bouger

## Architecture projection

```txt
.
├── backend-nest/
│   ├── supabase/
│   │   ├── migrations/20261125120000_link_movement_to_account.sql ✅
│   │   └── tests/
│   │       ├── movement_account_link.sql ✅
│   │       └── README.md ✏️
│   └── src/
│       ├── types/database.types.ts ✏️
│       └── modules/asset/
│           ├── domain/asset.entity.ts ✏️
│           ├── domain/asset.formulas.ts ✏️
│           ├── domain/asset.formulas.spec.ts ✏️
│           ├── domain/ports/asset-repository.port.ts ✏️
│           ├── application/get-net-worth.use-case.ts ✏️
│           ├── application/get-net-worth.use-case.spec.ts ✏️
│           ├── infrastructure/persistence/supabase-asset.repository.ts ✏️
│           └── infrastructure/persistence/supabase-asset.repository.spec.ts ✏️
└── docs/BUSINESS_RULES.md ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Jeu d'essai du ticket (Compte courant 5 000, Revolut 400, Livret 10 000, Leasing 8 000, CHF) en fixture de formule et en base locale | brute 15 400, dettes 8 000, nette 7 400 | system |
| Happy path | Imprévu Dépense 80 compte Compte courant pointé (CA5) ; Revenu 6 000 (CA6) | 4 920 / nette 7 320 ; 11 000 / 13 400 | system |
| Happy path | Épargne 500 Compte courant → Livret (CA7) ; Dépense 300 Compte courant → Leasing (CA8) ; Revenu 1 000 tiré du Livret → Compte courant (CA9) | 4 500 et 10 500 ; 4 700 et 7 700 ; 9 000 et 6 000, nette 7 400 | system |
| Happy path | Prévision « Courses » 400 + réel 120 (CA17, CA18, CA19 avec 450) ; Épargne 500 + 600 de réels (CA20) | 4 880, 4 600, 4 550 ; 4 400 et 10 600 | system |
| Edge case  | Dépointer, changer de compte, supprimer « Restaurant » (CA10, CA11, CA12) ; compte « Aucun » + Versée sur (CA13) | 5 000 ; 5 000 et Revolut 320 ; 5 000 ; Livret 10 500 | system |
| Edge case  | Dépense 500 sur Revolut (CA14) ; compte EUR avec et sans taux (CA16) | −100, découvert, côté dettes ; converti, sinon dernière saisie | system |
| Edge case  | Saisie 4 880 entre le réel 120 et le pointage de « Courses » (CA15) | 4 600 | system |
| Edge case  | Carte de crédit 200 : CA37, CA38, CA39 (50 puis 300), CA40, CA41 | 280 ; 200 ; 150 puis 0 ; 500 et Leasing 7 700 ; repart des saisies | system |
| Edge case  | Leasing 200, remboursement 300 puis achat 100 pointé après (CA6 de 377) | 0 puis 100 | system |
| Edge case  | Un seul compte, un mois entier, sans saisie (CA21) ; Salaire 6 000 + réel 6 000 (CA43) | delta compte = delta solde pointé ; 11 000 contre 12 000 au budget | system |
| Edge case  | Supprimer « Courses » 400 Revolut avec 120 de réels pointés (CA46) ; supprimer Revolut (CA24) ; archiver Revolut | réel libéré porte Revolut, Revolut 280 ; liens à `null` ; lien gardé, valeur figée | system |
| Edge case  | Compte d'un autre utilisateur ; même élément en `account_id` et `asset_id` (CA25) ; suppression de l'utilisateur | « Account access denied » ; violation du CHECK ; cascade sans erreur | system |
| Teardown   | Chaque script SQL dans `BEGIN … ROLLBACK` | base intacte | system |

## Tasks to do

### `1)` Migration du lien

> Le lien existe, protégé, et se lit en une requête.

1. Contract, `safe-after v0.66.2`, en-tête expliquant pourquoi (FK inline, REVOKE ; rien de déployé ne lit `account_id`).
2. `account_id uuid REFERENCES public.asset (id) ON DELETE SET NULL` sur `budget_line`, `template_line`, `transaction` ; index partiels `WHERE account_id IS NOT NULL`.
3. `CHECK (account_id <> asset_id)` nommé `*_account_not_asset` sur `budget_line` et `template_line`.
4. `enforce_account_link()` calquée sur `enforce_asset_line_link` : propriétaire via `monthly_budget` (budget_line, transaction) ou `template` ; sinon `RAISE 'Account access denied'` ; aucune règle de sens. Triggers `BEFORE INSERT OR UPDATE OF account_id, budget_id|template_id`. REVOKE.
5. `carry_account_to_freed_transactions()` (invoker) : `BEFORE DELETE ON budget_line FOR EACH ROW WHEN (OLD.account_id IS NOT NULL)`, `UPDATE transaction SET account_id = OLD.account_id WHERE budget_line_id = OLD.id AND EXISTS (asset OLD.account_id)`.
6. `list_asset_movements(p_since timestamptz)` (sql, stable, invoker, `search_path ''`) : lignes liées (`account_id` ou `asset_id`) pointées après `p_since` ou ayant un réel pointé après ; tous les réels pointés de ces lignes ; mouvements libres avec compte pointés après. `GRANT EXECUTE TO authenticated`.
7. `bun run supabase:reset`, `bun run generate-types:local`.

### `2)` Formule

> La valeur suit la règle du solde pointé, coupée par la dernière saisie.

1. Entités : `MovementLine {id, kind, amount, checkedAt, accountId, assetId, checkedReals[]}` et `FreeMovement {accountId, kind, amount, checkedAt}` remplacent `CheckedLinkedLine`.
2. `counted(line, t)` = réels pointés au plus tard à t, ou max(montant, cette somme) si la ligne est pointée au plus tard à t.
3. Par élément actif de seuil S : chaque ligne liée donne, aux instants > S (son pointage, ceux de ses réels), l'écart positif entre deux `counted` successifs depuis `counted(line, S)` ; chaque mouvement libre pointé après S donne son montant.
4. Signe : `account_id` → own Revenu +, Dépense/Épargne − ; owe l'inverse. `asset_id` → règle existante.
5. Événements triés par instant, convertis au taux par événement, dette bornée à 0 à chaque pas ; archivé ou sans taux : dernière saisie.

### `3)` Lecture

1. Port `findMovementsSince(since)`, repository : `rpc('list_asset_movements')`, déchiffrement strict, réels groupés par ligne.
2. `GetNetWorthUseCase` : seuil = plus ancienne saisie des éléments actifs ; aucun appel sans élément actif.

### `4)` Tests

1. `asset.formulas.spec.ts` : CA5–CA21, CA24 (archivé), CA37–CA41, CA43, CA46 (valeur), CA6 de 377 ; tests 377 migrés.
2. `movement_account_link.sql` : garde (3 tables, autre utilisateur), CA25, CA24, CA46 dans la même instruction, suppression d'utilisateur, `list_asset_movements` (sélection, RLS).
3. Spec du repository et du use case.

### `5)` Règles métier

1. § Patrimoine : remplacer « pour leur montant prévu » par la règle du solde pointé, la coupe par saisie et les signes du compte ; ajouter le lien « Compte ».

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Migration appliquée deux fois en local sans erreur ; types régénérés ; le checker de migration accepte l'en-tête. |
| 2 | CA5–CA21, CA37–CA41, CA43 et l'ordre de pointage prouvés avec les montants du ticket. |
| 3 | `GET /v1/assets` lit les mouvements en un appel ; aucun montant non déchiffrable ne bouge une valeur. |
| 4 | `bun test` du module vert ; la suite SQL imprime `ASSERTIONS PASSED`, dont CA46 et la cascade utilisateur. |
| 5 | La section décrit la règle du solde pointé et ses limites (CA43, dette à zéro). |
