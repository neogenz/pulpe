# Implementation Plan: Transactions Allouées aux Prévisions Budgétaires

## Overview

Cette feature permet d'associer optionnellement une transaction à une ligne budgétaire (BudgetLine) pour suivre précisément la consommation par enveloppe. L'implémentation suit une approche additive et backward-compatible.

**Stratégie:** Migration DB → Validation Backend → Calculs → API → Frontend Affichage → CRUD → E2E

**Contraintes clés:**
- `budget_line_id` est nullable → transactions existantes non impactées
- FK avec ON DELETE SET NULL → si BudgetLine supprimée, transaction devient "libre"
- Même kind (income/expense/saving) requis entre transaction et BudgetLine
- Même budgetId requis

---

## Dependencies

L'ordre d'exécution est strict: **T1 → T2 → T3 → T4 → T5 → T6**

| Phase | Prérequis |
|-------|-----------|
| T1 (Migration + Validation) | Aucun |
| T2 (Calculs) | T1 (colonne budget_line_id existe) |
| T3 (API enrichie) | T2 (méthodes calcul disponibles) |
| T4 (Frontend affichage) | T3 (API retourne données enrichies) |
| T5 (Frontend CRUD) | T4 (composants affichage existent) |
| T6 (E2E) | T5 (toutes fonctionnalités implémentées) |

---

## File Changes

### Phase T1: Migration DB, Shared Schemas, Validation Backend

#### `backend-nest/supabase/migrations/[timestamp]_add_budget_line_id_to_transaction.sql`
- **Action:** Créer nouveau fichier migration avec timestamp actuel
- **Contenu:**
  - ALTER TABLE pour ajouter colonne `budget_line_id UUID NULL`
  - Commentaire SQL descriptif sur la colonne
  - Index partiel sur `budget_line_id` WHERE NOT NULL (performance)
  - Contrainte FK vers `budget_line(id)` avec ON DELETE SET NULL
- **Pattern:** Suivre `20250828165030_add_ending_balance_to_monthly_budget.sql`

#### `shared/schemas.ts`
- **Action:** Ajouter `budgetLineId` aux schemas transaction
- **Dans `transactionSchema`:** Ajouter `budgetLineId: z.uuid().nullable()`
- **Dans `transactionCreateSchema`:** Ajouter `budgetLineId: z.uuid().nullable().optional()`
- **Dans `transactionUpdateSchema`:** Ajouter `budgetLineId: z.uuid().nullable().optional()`
- **Export:** S'assurer que les types inférés sont exportés

#### `backend-nest/src/common/constants/error-definitions.ts`
- **Action:** Ajouter définitions d'erreurs pour validation transaction allouée
- **Nouvelle erreur:** `TRANSACTION_BUDGET_LINE_BUDGET_MISMATCH`
  - Code: `ERR_TRANSACTION_BUDGET_LINE_BUDGET_MISMATCH`
  - Message: "BudgetLine does not belong to this budget"
  - HttpStatus: BAD_REQUEST
- **Nouvelle erreur:** `TRANSACTION_BUDGET_LINE_KIND_MISMATCH`
  - Code: `ERR_TRANSACTION_BUDGET_LINE_KIND_MISMATCH`
  - Message: "Transaction kind must match BudgetLine kind"
  - HttpStatus: BAD_REQUEST
- **Nouvelle erreur:** `BUDGET_LINE_NOT_FOUND`
  - Code: `ERR_BUDGET_LINE_NOT_FOUND`
  - Message: "BudgetLine not found"
  - HttpStatus: NOT_FOUND
- **Pattern:** Suivre structure existante dans TRANSACTION section

#### `backend-nest/src/modules/transaction/transaction.service.ts`
- **Action 1:** Injecter `BudgetLineService` dans le constructeur
- **Action 2:** Dans `validateCreateTransactionDto()`, ajouter validation si `budgetLineId` fourni:
  - Récupérer la BudgetLine via BudgetLineService
  - Vérifier que `budgetLine.budgetId === dto.budgetId`
  - Vérifier que `budgetLine.kind === dto.kind`
  - Throw BusinessException avec erreurs appropriées si validation échoue
- **Action 3:** Dans `prepareTransactionData()`, mapper `budgetLineId` vers `budget_line_id`
- **Consider:** Validation async donc méthode devient async si pas déjà

#### `backend-nest/src/modules/transaction/transaction.mappers.ts`
- **Action 1:** Dans `toApi()`, ajouter mapping `budgetLineId: transactionDb.budget_line_id`
- **Action 2:** Dans `toInsert()`, ajouter `budget_line_id: dto.budgetLineId ?? null`
- **Action 3:** Dans `toUpdate()`, gérer `budgetLineId` optionnel avec conditional spread

#### `backend-nest/src/types/database.types.ts`
- **Action:** Régénérer avec `bun run generate-types:local` après migration appliquée
- **Note:** Commande depuis dossier backend-nest

#### `backend-nest/src/modules/transaction/transaction.service.spec.ts`
- **Action:** Ajouter tests pour validation transaction allouée
- **Test 1:** Transaction avec budgetLineId valide et même kind → succès
- **Test 2:** Transaction avec budgetLineId d'un autre budget → erreur BUDGET_MISMATCH
- **Test 3:** Transaction avec budgetLineId mais kind différent → erreur KIND_MISMATCH
- **Test 4:** Transaction sans budgetLineId → succès (backward compatible)
- **Test 5:** Transaction avec budgetLineId inexistant → erreur NOT_FOUND

---

### Phase T2: Calculs Métier

#### `backend-nest/src/modules/budget-line/budget-line.service.ts`
- **Action 1:** Créer méthode `getConsumedAmount(budgetLineId: string, supabase: SupabaseClient): Promise<number>`
  - Query: SELECT SUM(amount) FROM transaction WHERE budget_line_id = budgetLineId
  - Retourner 0 si aucune transaction (COALESCE)
- **Action 2:** Créer méthode `getRemainingAmount(budgetLineId: string, supabase: SupabaseClient): Promise<number>`
  - Récupérer budgetLine.amount
  - Appeler getConsumedAmount()
  - Retourner `budgetLine.amount - consumedAmount`
- **Action 3:** Créer méthode `getAllocatedTransactions(budgetLineId: string, supabase: SupabaseClient): Promise<Transaction[]>`
  - Query: SELECT * FROM transaction WHERE budget_line_id = budgetLineId ORDER BY transaction_date DESC
  - Mapper résultats via transactionMappers.toApiList()
- **Note:** Pas de modification dans BudgetService - calcul global fonctionne déjà

#### `backend-nest/src/modules/budget-line/budget-line.service.spec.ts`
- **Action:** Ajouter tests pour méthodes de calcul
- **Test 1:** getConsumedAmount avec plusieurs transactions → somme correcte
- **Test 2:** getConsumedAmount sans transactions → retourne 0
- **Test 3:** getRemainingAmount calcul correct (prévu - consommé)
- **Test 4:** getAllocatedTransactions triées par date DESC

---

### Phase T3: API Enrichie

#### `backend-nest/src/modules/budget-line/dto/budget-line-with-transactions.dto.ts`
- **Action:** Créer nouveau fichier DTO
- **Interface `BudgetLineWithTransactionsDto`:**
  - `budgetLine: BudgetLine`
  - `consumedAmount: number`
  - `remainingAmount: number`
  - `allocatedTransactions: Transaction[]`
- **Pattern:** Suivre structure DTOs existants

#### `backend-nest/src/modules/budget-line/budget-line.controller.ts`
- **Action 1:** Créer endpoint `GET /budget-lines/:id/transactions`
  - Appeler `budgetLineService.getAllocatedTransactions()`
  - Retourner `{ success: true, data: transactions }`
- **Action 2:** Swagger decorator avec @ApiOperation, @ApiResponse
- **Pattern:** Suivre structure endpoints existants dans le fichier

#### `backend-nest/src/modules/budget/budget.controller.ts`
- **Action:** Modifier ou créer endpoint `GET /budgets/:id/lines`
  - Pour chaque budgetLine, enrichir avec:
    - consumedAmount via `budgetLineService.getConsumedAmount()`
    - remainingAmount via `budgetLineService.getRemainingAmount()`
    - allocatedTransactions via `budgetLineService.getAllocatedTransactions()`
  - Retourner `BudgetLineWithTransactionsDto[]`
- **Consider:** Si endpoint existe déjà, enrichir réponse; sinon créer

#### `backend-nest/src/modules/budget/budget.service.ts`
- **Action:** Créer méthode `getBudgetLinesWithTransactions(budgetId: string, supabase): Promise<BudgetLineWithTransactionsDto[]>`
  - Récupérer toutes les budgetLines du budget
  - Pour chaque ligne, appeler méthodes de calcul
  - Assembler DTOs enrichis
- **Note:** Méthode appelée par controller

#### Tests d'intégration
- **Action:** Ajouter tests e2e backend dans fichier approprié
- **Test 1:** GET /budgets/:id/lines retourne données enrichies
- **Test 2:** GET /budget-lines/:id/transactions retourne transactions triées
- **Test 3:** Création transaction allouée → montants recalculés

---

### Phase T4: Frontend Affichage

#### `shared/schemas.ts` (complément)
- **Action:** Ajouter schema et type `BudgetLineWithTransactions`
- **Schema:** Objet avec budgetLine, consumedAmount (number), remainingAmount (number), allocatedTransactions (array)
- **Export:** Type inféré pour usage frontend

#### `frontend/projects/webapp/src/app/data/budget-line-api.ts`
- **Action 1:** Créer ou mettre à jour service API
- **Méthode:** `getBudgetLinesWithTransactions$(budgetId: string): Observable<BudgetLineWithTransactions[]>`
  - Endpoint: GET /budgets/:budgetId/lines
- **Méthode:** `getAllocatedTransactions$(budgetLineId: string): Observable<Transaction[]>`
  - Endpoint: GET /budget-lines/:budgetLineId/transactions
- **Pattern:** Suivre budget-api.ts existant

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/allocated-transactions-dialog.ts`
- **Action:** Créer nouveau composant dialog
- **Interface data:** `{ budgetLine: BudgetLine, budgetLineWithTransactions: BudgetLineWithTransactions }`
- **Template:**
  - Header avec nom de la BudgetLine
  - Affichage "X CHF prévus · Y CHF dépensés · Z CHF restants"
  - Liste des transactions (date, description, montant)
  - Message "Aucune transaction enregistrée" si liste vide
  - Bouton "[+ Ajouter une transaction]" (émit event, implémenté T5)
  - Actions éditer/supprimer sur chaque ligne (désactivés pour T4, actifs T5)
  - Bouton Fermer
- **Tri:** Transactions par date DESC (plus récente en premier)
- **Pattern:** Suivre `edit-budget-line-dialog.ts`

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.ts`
- **Action 1:** Ajouter entrée menu "Voir les transactions" dans MatMenu mobile
- **Action 2:** Ajouter bouton/icône équivalent pour vue desktop
- **Action 3:** Au clic, ouvrir `AllocatedTransactionsDialog` avec données de la ligne
- **Action 4:** Afficher chips info dans colonne montant: "X CHF dépensés · Y CHF restants"
- **Consider:** Récupérer BudgetLineWithTransactions depuis store ou passer via input

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
- **Action 1:** Modifier type de `budgetLines` pour inclure données enrichies
- **Action 2:** Mettre à jour appel API pour utiliser endpoint enrichi
- **Action 3:** Exposer computed pour accéder aux données transactions par ligne
- **Note:** Préparation pour T5 (méthodes CRUD)

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/allocated-transactions-dialog.spec.ts`
- **Action:** Tests unitaires du dialog
- **Test 1:** Affichage liste transactions
- **Test 2:** Affichage message vide si aucune transaction
- **Test 3:** Calculs affichés correctement
- **Test 4:** Tri par date DESC

---

### Phase T5: Frontend CRUD

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/allocated-transaction-form-dialog.ts`
- **Action:** Créer composant formulaire transaction
- **Interface data:** `{ budgetLineId: string, budgetId: string, kind: TransactionKind, transaction?: Transaction }`
- **Form fields:**
  - amount: required, Validators.min(0.01)
  - name/description: required, Validators.minLength(1)
  - transactionDate: default aujourd'hui, date picker
- **Champs cachés:** budgetLineId, budgetId, kind (auto-remplis depuis data)
- **Modes:** Création (transaction undefined) vs Edition (transaction fournie)
- **Return:** TransactionCreate ou TransactionUpdate au submit
- **Pattern:** Suivre `edit-budget-line-dialog.ts`

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/allocated-transactions-dialog.ts` (complément T5)
- **Action 1:** Implémenter bouton "Ajouter" → ouvre AllocatedTransactionFormDialog
- **Action 2:** Implémenter icône éditer → ouvre AllocatedTransactionFormDialog avec transaction
- **Action 3:** Implémenter icône supprimer → ouvre ConfirmationDialog
- **Action 4:** Après actions, émettre événement vers parent ou appeler store directement
- **Action 5:** Afficher Snackbar après succès/erreur

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts` (complément T5)
- **Action 1:** Méthode `createAllocatedTransaction(transaction: TransactionCreate): Promise<void>`
  - Optimistic update: ajouter transaction temp dans liste
  - API call: POST /transactions
  - Success: remplacer temp par vraie transaction, recalculer montants
  - Error: revert, afficher erreur
- **Action 2:** Méthode `updateAllocatedTransaction(id: string, update: TransactionUpdate): Promise<void>`
  - Pattern similaire avec optimistic update
- **Action 3:** Méthode `deleteAllocatedTransaction(id: string): Promise<void>`
  - Pattern similaire avec optimistic update
- **Note:** Appeler recalcul montants après chaque mutation

#### `frontend/projects/webapp/src/app/data/transaction-api.ts`
- **Action:** Vérifier/ajouter méthodes CRUD pour transactions
- **Méthodes nécessaires:**
  - `createTransaction$(transaction: TransactionCreate): Observable<Transaction>`
  - `updateTransaction$(id: string, update: TransactionUpdate): Observable<Transaction>`
  - `deleteTransaction$(id: string): Observable<void>`
- **Note:** Probablement déjà existant, vérifier et compléter si besoin

#### Tests unitaires T5
- **Fichier 1:** `allocated-transaction-form-dialog.spec.ts`
  - Test validation formulaire
  - Test mode création vs édition
  - Test soumission valide
- **Fichier 2:** `budget-details-store.spec.ts` (compléments)
  - Test createAllocatedTransaction optimistic + success
  - Test createAllocatedTransaction error + rollback
  - Tests similaires pour update/delete

---

### Phase T6: Tests E2E

#### `frontend/projects/webapp-e2e/tests/budget-allocated-transactions.spec.ts`
- **Action:** Créer suite de tests Playwright
- **Scénario 1: Création transaction allouée**
  - Given: Budget avec BudgetLine "Essence" 120 CHF
  - When: Ouvrir dialog, ajouter transaction 65 CHF
  - Then: Transaction visible, montants mis à jour
- **Scénario 2: Modification transaction**
  - Given: Transaction existante
  - When: Éditer montant
  - Then: Montant modifié, calculs recalculés
- **Scénario 3: Suppression transaction**
  - Given: Transaction existante
  - When: Supprimer avec confirmation
  - Then: Transaction disparue, montants recalculés
- **Scénario 4: Vérification calculs**
  - Given: Multiple transactions
  - When: Affichage
  - Then: Somme correcte, remaining correct
- **Scénario 5: Régression transactions libres**
  - Given: Transaction sans budgetLineId
  - When: Création depuis interface standard
  - Then: Fonctionne comme avant
- **Tests responsive:** Mobile (menu) + Desktop (boutons)

---

## Testing Strategy

### Tests unitaires Backend
- `transaction.service.spec.ts`: Validation budgetLineId
- `budget-line.service.spec.ts`: Calculs consumedAmount, remainingAmount

### Tests unitaires Frontend
- `allocated-transactions-dialog.spec.ts`: Affichage, liste vide, tri
- `allocated-transaction-form-dialog.spec.ts`: Validation, modes
- `budget-details-store.spec.ts`: CRUD optimistic updates

### Tests E2E
- `budget-allocated-transactions.spec.ts`: Parcours utilisateur complet

### Tests manuels
- Vérifier calcul Remaining global après ajout transaction allouée
- Vérifier backward compatibility transactions existantes
- Vérifier mobile et desktop

---

## Documentation

- **Swagger:** Documenter nouveaux endpoints automatiquement via decorators NestJS
- **Pas de README spécifique:** Feature intégrée naturellement

---

## Rollout Considerations

### Migration
- **Type:** Additive (nouvelle colonne nullable)
- **Breaking changes:** Aucun
- **Rollback:** DROP COLUMN si nécessaire

### Backward Compatibility
- Transactions existantes ont `budget_line_id = NULL` → continuent de fonctionner
- API existantes non modifiées dans leur comportement de base
- UI existante de création transaction non impactée (budgetLineId optionnel)

### Risques
- **Faible:** Migration simple, pas de transformation de données
- **Performance:** Index partiel sur budget_line_id pour queries rapides

### Ordre de déploiement
1. Déployer migration DB
2. Déployer backend (validation + API)
3. Déployer frontend
4. Pas de feature flag nécessaire (backward compatible)
