---
status: done
track: B
---

# Instruction: Le contrat « prévision provenant d'un objectif » et sa réalisation atomique

La prévision doit porter une origine propre, sans détourner le lien de contribution. Le client ne
duplique pas cette origine sur la transaction allouée : le serveur la récupère depuis la prévision,
valide le solde courant et réutilise l'écriture atomique de PUL-329.

> **Invariant PUL-329 rouvert, à argumenter dans le code.** `transactionCreateSchema` refuse
> aujourd'hui `sourceSavingsGoalId` en présence d'un `budgetLineId`, au motif qu'« allouer la
> transaction à une prévision ferait double emploi avec les contributions de l'objectif ». Ce motif
> vise une prévision **de contribution** (`savingsGoalId`, `kind=saving`), pas une prévision
> **source** (`sourceSavingsGoalId`, `kind=income`) : la première alimente le pot, la seconde le
> vide. Le contrat client reste strict et l'héritage reste serveur, mais la distinction doit être
> écrite au-dessus de la garde, sinon la relecture la lira comme un contournement.

## Architecture ciblée

```text
shared/schemas.ts                                               ✏️ contrat budget_line
backend-nest/supabase/migrations/<timestamp>_planned_goal_withdrawals.sql
backend-nest/src/modules/budget-line/
├── domain/budget-line.entity.ts                               ✏️ champs source
├── domain/budget-line.invariants.ts                           ✏️ revenu one_off non pointé
├── application/create-budget-line.use-case.ts                 ✏️ snapshot du nom
└── infrastructure/persistence/supabase-budget-line.repository.ts
backend-nest/src/modules/transaction/
├── application/create-transaction.use-case.ts                 ✏️ source héritée
└── infrastructure/persistence/supabase-transaction.repository.ts
backend-nest/src/modules/budget-line/application/
└── toggle-budget-line-check.use-case.ts                       ✏️ refus du pointage direct
backend-nest/src/types/database.types.ts                       🔁 généré après migration
```

## Tasks to do

### `1)` Étendre le contrat sans casser les invariants existants

1. Ajouter à la lecture `BudgetLine` :
   `sourceSavingsGoalId: string | null` et `sourceSavingsGoalName: string | null`.
2. Ajouter uniquement `sourceSavingsGoalId?: string` à `BudgetLineCreate`; le nom snapshot appartient
   au serveur.
3. Exclure le champ de `BudgetLineUpdate` : la source est immuable.
4. Valider côté schéma et domaine : source autorisée seulement pour `income`, `one_off`,
   `checkedAt=null`, sans `savingsGoalId` de contribution, sans PUL-292 ni lissage.
5. Ne pas assouplir le contrat client `TransactionCreate` : une source explicitement envoyée avec un
   `budgetLineId` reste invalide. L'héritage est interne au serveur.

### `2)` Persister le lien et son libellé survivant

1. Ajouter sur `budget_line` les colonnes `source_savings_goal_id` et
   `source_savings_goal_name`; l'identifiant référence l'objectif avec `ON DELETE SET NULL` et le nom
   reste présent après suppression.
2. Ajouter les CHECKs des trois états valides : ordinaire (deux nuls), actif (id + nom), orphelin
   (id nul + nom); refuser id sans nom et toute source sur un autre type de ligne.
3. Reprendre la garde de tenant déjà utilisée par le retrait réel : impossible de lier l'objectif
   d'un autre utilisateur.
4. À la création, charger l'objectif, vérifier l'accès tenant et écrire son nom snapshot. Conserver la
   règle du retrait réel : un objectif PAUSED ou COMPLETED peut encore financer un revenu ; ne jamais
   demander le nom au client.
5. Lancer `bun run generate-types:local` après application locale de la migration.

### `3)` Hériter la source lors d'une transaction allouée

1. Faire retourner par `fetchBudgetLineForAllocation` les deux champs source en plus de budget/kind.
2. Dans `CreateTransactionUseCase`, déterminer l'origine effective après validation de l'allocation :
   source explicite pour un revenu libre existant, ou source héritée pour une prévision source.
3. Passer les deux chemins par `SavingsGoalWithdrawalPolicyService` et la RPC atomique existante :
   montant converti, solde confirmé courant, révision attendue, insert de transaction avec
   `budget_line_id`, id source et nom snapshot.
4. Étendre la RPC sans créer une deuxième mécanique de retrait. Elle accepte une allocation seulement
   si la ligne appartient au même budget, est un revenu et porte ce même objectif.
5. Une prévision future peut dépasser le solde actuel ; seule la création du réel est refusée si le
   solde confirmé est insuffisant au moment du geste.
6. Si la ligne ne conserve plus que le nom snapshot après suppression de l'objectif, refuser la
   réalisation : elle ne doit jamais devenir silencieusement un revenu ordinaire.

### `4)` Interdire le faux « réalisé »

1. `ToggleBudgetLineCheckUseCase` refuse le passage à pointé d'une ligne source et renvoie une erreur
   métier explicite : il faut créer une transaction réelle.
2. Le dépointage d'une donnée historique incohérente reste possible si nécessaire ; la garde vise le
   passage `unchecked → checked`.
3. Ne pas marquer automatiquement la ligne pointée lors de l'insert : le revenu réel pointé est porté
   par la transaction. Sinon `calculateRealizedIncome` compterait ligne + transaction deux fois.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Les schémas acceptent un revenu `one_off` source non pointé et refusent dépense, épargne, récurrence, source modifiable et combinaison PUL-292. |
| 2 | Un autre tenant est refusé ; supprimer l'objectif rend l'id nul tout en conservant le nom snapshot sur la prévision. |
| 3 | Une transaction allouée hérite de la source, débite atomiquement le bon objectif et un solde insuffisant ne crée aucune transaction. |
| 4 | Pointer directement la prévision est refusé ; une transaction pointée n'entraîne aucun double comptage de revenu. |
