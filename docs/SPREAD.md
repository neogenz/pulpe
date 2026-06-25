# Lissage d'une dépense sur plusieurs mois (PUL-17)

> Pourquoi cette feature existe, et comment le modèle la résout sans nouvelle entité. La valeur métier d'abord ; les détails d'implémentation pointent vers le code.

## Le problème métier

Une grosse dépense irrégulière — prime d'assurance annuelle, impôts, gros achat planifié, versement 3ᵉ pilier / épargne retraite — tombe sur **un seul mois** et déforme le « Disponible à dépenser » de ce mois. La hero card vire ambre/rouge alors que l'utilisateur peut absorber le coût sans douleur s'il l'**étale**. C'est exactement l'angoisse que Pulpe existe pour tuer (*sérénité > contrôle*, *Planning > Tracking*).

Avant le lissage, l'enum `recurrence` n'offrait que deux extrêmes : **Récurrent** (`fixed`, tous les mois indéfiniment) et **Prévu** (`one_off`, une seule fois, un seul mois). Aucun moyen de dire « pose 100 CHF/mois de janvier à juin, mais saute mars ».

## Création additive : deux modes de saisie (`mode`)

La création d'une nouvelle dépense lissée offre **deux modes**, un seul champ `mode` les discrimine. Les deux se matérialisent en **N prévisions `one_off` INDÉPENDANTES**, une par mois, partageant un `spread_group_id` (interprétation modèle inchangée — seule la saisie diffère) :

| | **`total` — Total ÷ N** ⭐ (défaut) | **`perMonth` — Montant/mois répliqué** |
| -- | -- | -- |
| Source de vérité | un **total** + fenêtre | un **montant/mois** + fenêtre |
| Le serveur… | **divise** `totalAmount` sur les N mois (`splitTotalPreserving`, Σ === total) | **réplique** `perMonthAmount` sur chaque mois |
| Désélectionner un mois | la division se refait sur les mois restants | trivial (on retire ce mois, les autres ne bougent pas) |
| Modèle mental | « j'ai une dépense de 4000, lisse-la sur 8 mois » | « je mets 500/mois pendant 8 mois » |

Le mode `total` est l'**interprétation A** (initialement différée dans le périmètre PUL-17, cf. Q1) : c'est le plus intuitif, défaut UI. Le mode `perMonth` est l'**interprétation B** d'origine, gardé en secondaire. « Lisser » reste une **commodité de saisie**, pas un nouveau type de ligne ni une valeur de `recurrence`. Toute la machinerie existante (chiffrement per-row, FX figé, rollover, consumption, édition/suppression par mois, pointage) fonctionne sans entité cross-mois.

## Saisie (client) + construction (serveur)

L'utilisateur choisit le mode via un toggle (défaut `total`), saisit le montant correspondant et sélectionne les mois cibles. En mode `total`, le client divise **uniquement pour l'aperçu live** via `splitTotalPreserving` (l'aperçu égale le persisté, reste en centimes sur les premiers mois) ; en mode `perMonth`, l'aperçu est un simple `montant × n mois`.

**Clé de voûte :** le serveur **construit lui-même les tranches** — il reçoit une INTENTION (`{mode, perMonthAmount|totalAmount, months[], FX?}`), jamais des tranches pré-calculées. `perMonth` → `buildSpreadTranches` (réplication) ; `total` → `buildSpreadTranchesFromTotal` (division `splitTotalPreserving`, Σ === total). Le flux v1.1 « lisser un existant » est lui aussi total-préservant et fournit ses propres tranches via le même PORT.

## Résolution du modèle (les 3 « formes de dépense »)

| Forme | Modèle | Porte le lissage ? |
| -- | -- | -- |
| enveloppe / prévision | `budget_line` (`recurrence=one_off`) | **Oui** — porte `spread_group_id` |
| sous-dépense d'une enveloppe | `transaction` avec `budget_line_id` SET | Non — **dérive** via son `budget_line` parent |
| transaction libre | `transaction` avec `budget_line_id = NULL` | Ne porte jamais le groupe ; peut être la source remplacée en v1.1 |

- `spread_group_id uuid NULLABLE` vit sur `budget_line` **uniquement**. Une `transaction` n'est jamais une tranche ; sa lissé-ness est dérivable via son parent.
- **Aucun nesting** (`parent_id`) : les occurrences sont N lignes **sœurs** réparties horizontalement, pas un arbre.
- `spread_group_id` = uuid **non financier** → **jamais chiffré** (contrairement à `amount` / `original_amount`). Index **partiel** (`WHERE spread_group_id IS NOT NULL`) car les lignes lissées sont une fraction infime du total.
- `checked_at` existe nativement sur `budget_line` → une occurrence-enveloppe est **pointable sans promotion en transaction**.

## Le fan-out (Lot A — le cœur)

`POST /v1/budget-lines/spread` reçoit `{ name, kind, mode, perMonthAmount|totalAmount, months[], FX? }` et retourne `{ spreadGroupId, lines, createdBudgets, skippedMonths }`. Selon `mode`, le serveur **réplique** `perMonthAmount` ou **divise** `totalAmount` (`splitTotalPreserving`, Σ === total) sur chaque `{year, month}` de `months[]` pour construire les tranches avant le fan-out. En `total`, un mois non-provisionnable fait **échouer tout** (`fanOutStrict`, contrat Σ=total) ; en `perMonth`, le mois part dans `skippedMonths` (`fanOut` tolérant).

1. **Auto-création des mois manquants** *(scope caché majeur)* : pour chaque `{year, month}` sans budget, on crée le `monthly_budget` depuis le **template par défaut** (`is_default`) de l'utilisateur. Chaque création est sa **propre transaction courte** (idempotente : un mois existant est réutilisé), **hors** de la transaction du fan-out. Pas de template par défaut → le mois part dans `skippedMonths` et ne reçoit aucune ligne.
2. **Fan-out atomique** : un **seul** `INSERT … SELECT FROM jsonb_to_recordset(p_lines)` **set-based** (jamais une boucle PL/pgSQL) dans une RPC `SECURITY DEFINER` owner-only → **tout-ou-rien**. Chaque tranche est chiffrée via `ENCRYPTION_PORT` **dans le repository** avant l'appel ; `spread_group_id` (uuid, partagé, généré serveur) ne l'est jamais.
3. **FX figé** : un **seul** `exchangeRate` saisi à la création est partagé par toutes les tranches.
4. **Effets** : `recalculate(budgetId)` **par budget touché**, puis `cacheService.invalidateForUser(userId)` **une fois** (une écriture lissée touche N mois — l'invalidation cross-budget est le bug le plus probable à shipper si oubliée).

### Frontière d'atomicité (assumée)

Le fan-out des tranches est tout-ou-rien. L'auto-création des budgets est **best-effort idempotente** : un budget auto-créé n'est **pas** rollback si le fan-out échoue ensuite — un re-submit le réutilise. C'est volontaire (évite une méga-transaction et la contention de locks sur `monthly_budget`).

## Lecture (Lot B — indicateur, Lot C — occurrences)

- **Lot B** : pill « Lissé » sur la ligne (lecture locale de `spreadGroupId` déjà dans le payload, aucun round-trip). Icône calendrier — **jamais** `repeat` (réservé à Récurrent).
- **Lot C** : `GET /v1/budget-lines/spread/:spreadGroupId` liste toutes les occurrences cross-mois (read-only). Passé grisé, pointé barré (UI pointée existante réutilisée). Le **client** calcule passé/courant/futur, **payDay-aware** (`compareBudgetPeriods`), jamais un `isBefore` calendaire naïf. Le serveur renvoie `{month, year}` brut (figer passé/courant = stale sur un cache court).

## v1.1 — Lisser une dépense EXISTANTE (total préservé)

Distinct du fan-out de création additif ci-dessus. Ici la source **existe déjà** dans le mois courant M0 (une prévision `one_off` **ou** une transaction libre/réel) avec un montant total `T`. « Lisser » = **redistribuer** `T` en N tranches `one_off` de `T/N` (Σ === T exactement), une par mois M0..M(N-1), partageant un nouveau `spread_group_id`, puis **supprimer la source**. C'est l'**interprétation A** (total ÷ N) — initialement différée — appliquée à un existant.

**Exception RG-005 validée** : une transaction réelle s'ajoute normalement aux prévisions. Lorsqu'un utilisateur lisse explicitement une transaction libre, celle-ci est remplacée atomiquement par les prévisions lissées, dont la somme conserve exactement le montant initial. Le réel n'est pas conservé en parallèle, ce qui évite tout double comptage.

**Répartition (Σ = T garantie)** : `splitTotalPreserving(T, N)` (dans `pulpe-shared`, utilisée côté serveur **et** côté client pour l'aperçu live → l'aperçu égale toujours le persisté) répartit en **centimes** — `floor(T*100/N)` par tranche, le reste distribué un centime sur les **premières** tranches (M0 d'abord, jamais caché sur un mois lointain). `originalAmount` (FX) suit le même schéma. Le client n'envoie que les `periods` (mois cibles) ; le serveur lit `T` du montant **déchiffré** de la source (autorité unique → Σ=T ingarantissable côté client).

**Fenêtre** : démarre à M0 vers le **futur** uniquement (jamais réécrire un mois clôturé). N ≥ 2 (lisser sur 1 mois = no-op).

**Atomicité (renforcée vs le create additif)** : `delete(source)` + `insert(N tranches)` sont **une seule** transaction `SECURITY DEFINER` — la suppression de la source est **repliée dans la RPC** (`p_source_budget_line_id` / `p_source_transaction_id`). Le `DELETE` consomme et verrouille logiquement la source avant l'`INSERT` : un appel concurrent ou rejoué échoue avant de créer un second groupe. Toute erreur d'insertion rollbacke aussi la suppression. Après commit, chaque budget touché est recalculé une seule fois ; une erreur est signalée comme `partialFailure`, puis le cache utilisateur est invalidé.

**Endpoints** : `POST /v1/budget-lines/:id/spread` (source = prévision `one_off`, `kind ≠ income`, pas déjà lissée) et `POST /v1/transactions/:id/spread` (source = transaction **libre** `budgetLineId = null`, `kind ≠ income` ; une transaction allouée renvoie vers le lissage de sa prévision parente). Cross-module via `BUDGET_LINE_SPREAD_PORT` (+ `forwardRef` entre modules) : `fanOutStrict` (tout-ou-rien, échoue si un mois est non-provisionnable — contrat Σ=T) vs `fanOut` (tolérant — le create additif).

**Tracker de progression** : le panneau d'occurrences affiche « mois k/N · cumulé sur T · T/N par mois », 100 % dérivé des occurrences (aucun champ stocké) : cumulé = Σ des montants **réels** jusqu'au mois courant (jamais k×T/N — le reste casserait la multiplication).

## Hors scope V1 (différé)

Édition « en bloc » de la série (changer T ou N d'un groupe d'un coup), compteur `Lissé · X/N` **inline sur la pill** (le tracker vit dans le panneau d'occurrences, pas sur la ligne du mois), `remaining` par occurrence, suppression du groupe entier, lissage rétroactif sur mois **passés**, lissage de revenu, réutilisation de `savingsGoal` (les tranches posent `savingsGoalId = null`), parité **iOS** (web-first ; iOS dans un ticket séparé).

## Références

| Sujet | Fichier |
| -- | -- |
| Contrat (Zod) | `shared/schemas.ts` (`budgetLineSpreadCreateSchema`, `budgetLineSpreadResponseSchema`) |
| Colonne + index | `backend-nest/supabase/migrations/20260619120000_add_budget_line_spread_group_id.sql` |
| RPC set-based | `backend-nest/supabase/migrations/20260619130000_create_budget_lines_spread_rpc.sql` |
| Use-case fan-out | `backend-nest/src/modules/budget-line/application/create-budget-line-spread.use-case.ts` |
| Auto-création | `backend-nest/src/modules/budget/application/ensure-budgets-for-periods.use-case.ts` (port `BUDGET_PROVISIONING_PORT`) |
| Repo (encryption + RPC) | `backend-nest/src/modules/budget-line/infrastructure/persistence/supabase-budget-line.repository.ts` (`createSpread`) |
| **v1.1** Split Σ=T | `shared/src/calculators/spread-split.ts` (`splitTotalPreserving`) |
| **v1.1** RPC suppression atomique | `backend-nest/supabase/migrations/20260620120000_spread_rpc_atomic_source_delete.sql`, durcie contre les appels concurrents par `20260623150000_consume_spread_source_before_insert.sql` |
| **v1.1** Schémas from-existing | `shared/schemas.ts` (`budgetLineSpreadFromLineCreateSchema`, `transactionSpreadFromTxnCreateSchema`) |
| **v1.1** Use-case lisser prévision | `backend-nest/src/modules/budget-line/application/spread-budget-line-from-line.use-case.ts` |
| **v1.1** Use-case lisser réel | `backend-nest/src/modules/transaction/application/spread-transaction-from-txn.use-case.ts` |
| **v1.1** Dialogue total-driven + tracker | `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line/spread-existing/dialog.ts`, `.../spread-occurrences/spread-occurrence.view-model.ts` (`buildSpreadTracker`) |
| Chiffrement (contexte) | `docs/ENCRYPTION.md` |
