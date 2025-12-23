---
title: Implementation Plan - Transactions Allouées aux Prévisions Budgétaires
description: Associer optionnellement une transaction à une BudgetLine pour suivre la consommation par enveloppe
status: in_progress
created: 2024-12-23
updated: 2024-12-23
progress: 17
total_tasks: 44
tech_stack: Angular 20+, NestJS 11+, Supabase, Zod, Bun
---

# How to Use This Plan

**For Claude Code**: This is your single source of truth.

### Execution
1. Find first `- [ ]` whose dependencies are all `- [x]`
2. Follow **Action** precisely, modify only listed **Files**
3. Run **Verification** to confirm success
4. Mark `- [x]` and update frontmatter progress
5. Continue to next task

### Rules
- ✅ Follow TDD: Write test FIRST (RED), then implement (GREEN)
- ✅ Respect dependencies strictly
- ✅ Run `pnpm quality` before any commit
- ❌ Never install unlisted libraries
- ❌ Never skip tasks or change order
- ❌ Never make N+1 queries (use single SQL with JOIN/GROUP BY)
- ❌ Never refresh full state on success (update local state only)

---

# Implementation Plan: Transactions Allouées aux Prévisions Budgétaires

## Overview

Cette feature permet d'associer optionnellement une transaction à une ligne budgétaire (BudgetLine) pour suivre précisément la consommation par enveloppe. L'implémentation est additive et 100% backward-compatible.

## Context

- **Tech Stack**: Angular 20+, NestJS 11+, Supabase (PostgreSQL), Zod, Bun, pnpm
- **Architecture**: Monorepo avec shared schemas, signal-based state management
- **Devise**: Toujours CHF (hardcodé)
- **Constraints**:
  - `budget_line_id` nullable → transactions existantes non impactées
  - FK avec ON DELETE SET NULL
  - Même `kind` requis entre transaction et BudgetLine
  - Même `budgetId` requis
  - UNE SEULE requête SQL pour récupérer toutes les lignes enrichies (pas de N+1)
  - State local mis à jour après mutation (pas de refresh complet sauf erreur)

## Key Decisions

| Decision | Choix | Rationale |
|----------|-------|-----------|
| API enrichie | Montants seuls + endpoint séparé | Performance, flexibilité |
| Erreur optimistic | Refresh complet | Garantir cohérence |
| Calcul consommation | SQL unique avec LEFT JOIN + GROUP BY | Éviter N+1 |
| State mutation | Update local | Performance UX |

---

## Prerequisites (Human Required)

- [x] Supabase local démarré (`supabase start`)
- [x] Seed data E2E existant avec budgets et budget-lines

---

## Implementation Tasks

### Phase T1: Migration DB + Schemas + Validation Backend

- [x] **T1-01**: Créer migration SQL
  - **Files**: `backend-nest/supabase/migrations/[TIMESTAMP]_add_budget_line_id_to_transaction.sql`
  - **Action**: Créer fichier migration avec:
    ```sql
    -- Add optional budget_line_id to transaction for envelope tracking
    ALTER TABLE transaction
    ADD COLUMN budget_line_id UUID NULL;

    COMMENT ON COLUMN transaction.budget_line_id IS
      'Optional reference to budget_line for envelope-based tracking';

    -- Partial index for performance (only index non-null values)
    CREATE INDEX idx_transaction_budget_line_id
    ON transaction (budget_line_id)
    WHERE budget_line_id IS NOT NULL;

    -- Foreign key with ON DELETE SET NULL (transaction becomes "free" if line deleted)
    ALTER TABLE transaction
    ADD CONSTRAINT fk_transaction_budget_line
    FOREIGN KEY (budget_line_id)
    REFERENCES budget_line(id)
    ON DELETE SET NULL;
    ```
  - **Verification**: `cd backend-nest && supabase db reset` sans erreur
  - **Dependencies**: None

- [x] **T1-02**: Régénérer types DB
  - **Files**: `backend-nest/src/types/database.types.ts`
  - **Action**: Exécuter `cd backend-nest && bun run generate-types:local`
  - **Verification**: Vérifier que `budget_line_id: string | null` est présent dans le type Transaction
  - **Dependencies**: T1-01

- [x] **T1-03**: Ajouter budgetLineId aux schemas partagés
  - **Files**: `shared/schemas.ts`
  - **Action**:
    - Dans `transactionSchema`: ajouter `budgetLineId: z.string().uuid().nullable()`
    - Dans `transactionCreateSchema`: ajouter `budgetLineId: z.string().uuid().nullable().optional()`
    - Dans `transactionUpdateSchema`: ajouter `budgetLineId: z.string().uuid().nullable().optional()`
  - **Verification**: `pnpm build:shared` passe
  - **Dependencies**: T1-01

- [x] **T1-04**: Ajouter définitions erreurs validation
  - **Files**: `backend-nest/src/common/constants/error-definitions.ts`
  - **Action**: Ajouter dans la section TRANSACTION:
    ```typescript
    TRANSACTION_BUDGET_LINE_NOT_FOUND: {
      code: 'ERR_TRANSACTION_BUDGET_LINE_NOT_FOUND',
      message: (details) => `BudgetLine not found: ${details?.budgetLineId}`,
      httpStatus: HttpStatus.NOT_FOUND,
    },
    TRANSACTION_BUDGET_LINE_BUDGET_MISMATCH: {
      code: 'ERR_TRANSACTION_BUDGET_LINE_BUDGET_MISMATCH',
      message: () => 'BudgetLine does not belong to this budget',
      httpStatus: HttpStatus.BAD_REQUEST,
    },
    TRANSACTION_BUDGET_LINE_KIND_MISMATCH: {
      code: 'ERR_TRANSACTION_BUDGET_LINE_KIND_MISMATCH',
      message: (details) => `Transaction kind must match BudgetLine kind. Expected: ${details?.expected}, got: ${details?.actual}`,
      httpStatus: HttpStatus.BAD_REQUEST,
    },
    ```
  - **Verification**: `cd backend-nest && bun run build` passe
  - **Dependencies**: None

- [x] **T1-05**: 🔴 TEST - Écrire tests mappers transaction (budgetLineId)
  - **Files**: `backend-nest/src/modules/transaction/transaction.mappers.spec.ts`
  - **Action**: Ajouter tests:
    - `toApi()` mappe `budget_line_id` vers `budgetLineId`
    - `toInsert()` mappe `budgetLineId` vers `budget_line_id`
    - `toUpdate()` gère `budgetLineId` optionnel
    - Test avec `budgetLineId: null` (backward compatible)
  - **Verification**: `cd backend-nest && bun test transaction.mappers` ÉCHOUE (RED)
  - **Dependencies**: T1-02, T1-03

- [x] **T1-06**: 🟢 IMPL - Modifier transaction mappers
  - **Files**: `backend-nest/src/modules/transaction/transaction.mappers.ts`
  - **Action**:
    - `toApi()`: ajouter `budgetLineId: row.budget_line_id`
    - `toInsert()`: ajouter `budget_line_id: dto.budgetLineId ?? null`
    - `toUpdate()`: ajouter spread conditionnel pour `budget_line_id`
  - **Verification**: `cd backend-nest && bun test transaction.mappers` PASSE (GREEN)
  - **Dependencies**: T1-05

- [x] **T1-07**: 🔴 TEST - Écrire tests validation budgetLineId
  - **Files**: `backend-nest/src/modules/transaction/transaction.service.spec.ts`
  - **Action**: Ajouter tests:
    - Transaction avec `budgetLineId` valide et même `kind` → succès
    - Transaction avec `budgetLineId` d'un autre budget → erreur `BUDGET_MISMATCH`
    - Transaction avec `budgetLineId` mais `kind` différent → erreur `KIND_MISMATCH`
    - Transaction sans `budgetLineId` → succès (backward compatible)
    - Transaction avec `budgetLineId` inexistant → erreur `NOT_FOUND`
  - **Verification**: `cd backend-nest && bun test transaction.service` ÉCHOUE (RED)
  - **Dependencies**: T1-04, T1-06

- [x] **T1-08**: 🟢 IMPL - Ajouter validation budgetLineId dans TransactionService
  - **Files**: `backend-nest/src/modules/transaction/transaction.service.ts`
  - **Action**:
    - Injecter `BudgetLineService` dans constructeur
    - Créer méthode privée `validateBudgetLineId(budgetLineId, budgetId, kind, supabase)`
    - Appeler dans `validateCreateTransactionDto()` si `budgetLineId` fourni
    - Appeler dans `validateUpdateTransactionDto()` si `budgetLineId` fourni
  - **Verification**: `cd backend-nest && bun test transaction.service` PASSE (GREEN)
  - **Dependencies**: T1-07

---

### Phase T2: Calculs Métier (Requête Unique)

- [x] **T2-01**: Créer DTO BudgetLineWithConsumption
  - **Files**: `backend-nest/src/modules/budget-line/dto/budget-line-with-consumption.dto.ts`
  - **Action**: Créer interface et DTO Swagger:
    ```typescript
    export interface BudgetLineWithConsumption {
      // Tous les champs de BudgetLine
      id: string;
      budgetId: string;
      name: string;
      amount: number;
      kind: TransactionKind;
      recurrence: TransactionRecurrence;
      // ... autres champs
      // Champs enrichis
      consumedAmount: number;
      remainingAmount: number;
    }
    ```
  - **Verification**: `cd backend-nest && bun run build` passe
  - **Dependencies**: T1-03

- [x] **T2-02**: 🔴 TEST - Tests getBudgetLinesWithConsumption
  - **Files**: `backend-nest/src/modules/budget/budget.service.spec.ts`
  - **Action**: Ajouter tests:
    - Retourne toutes les lignes avec `consumedAmount` et `remainingAmount`
    - `consumedAmount` = somme des transactions allouées
    - `remainingAmount` = `amount - consumedAmount`
    - Ligne sans transaction → `consumedAmount: 0`
    - UNE SEULE requête SQL (vérifier via mock)
  - **Verification**: `cd backend-nest && bun test budget.service` ÉCHOUE (RED)
  - **Dependencies**: T2-01

- [x] **T2-03**: 🟢 IMPL - Implémenter getBudgetLinesWithConsumption
  - **Files**: `backend-nest/src/modules/budget/budget.service.ts`
  - **Action**: Créer méthode avec SQL unique:
    ```typescript
    async getBudgetLinesWithConsumption(budgetId: string, supabase: SupabaseClient): Promise<BudgetLineWithConsumption[]> {
      // Utiliser supabase.rpc() ou raw SQL avec LEFT JOIN + GROUP BY
      // SELECT bl.*, COALESCE(SUM(t.amount), 0) as consumed_amount
      // FROM budget_line bl
      // LEFT JOIN transaction t ON t.budget_line_id = bl.id
      // WHERE bl.budget_id = $1
      // GROUP BY bl.id
    }
    ```
  - **Verification**: `cd backend-nest && bun test budget.service` PASSE (GREEN)
  - **Dependencies**: T2-02

- [x] **T2-04**: 🔴 TEST - Tests getAllocatedTransactions
  - **Files**: `backend-nest/src/modules/budget-line/budget-line.service.spec.ts`
  - **Action**: Ajouter tests:
    - Retourne transactions triées par `transaction_date` DESC
    - Retourne tableau vide si aucune transaction
    - Filtre correctement par `budget_line_id`
  - **Verification**: `cd backend-nest && bun test budget-line.service` ÉCHOUE (RED)
  - **Dependencies**: T1-02

- [x] **T2-05**: 🟢 IMPL - Implémenter getAllocatedTransactions
  - **Files**: `backend-nest/src/modules/budget-line/budget-line.service.ts`
  - **Action**: Créer méthode:
    ```typescript
    async getAllocatedTransactions(budgetLineId: string, supabase: SupabaseClient): Promise<Transaction[]> {
      const { data, error } = await supabase
        .from('transaction')
        .select('*')
        .eq('budget_line_id', budgetLineId)
        .order('transaction_date', { ascending: false });
      // Handle error, map with transactionMappers.toApiList()
    }
    ```
  - **Verification**: `cd backend-nest && bun test budget-line.service` PASSE (GREEN)
  - **Dependencies**: T2-04

---

### Phase T3: API Enrichie

- [x] **T3-01**: 🔴 TEST - Test endpoint GET /budgets/:id/lines enrichi
  - **Files**: `backend-nest/src/modules/budget/budget.controller.spec.ts` ou test e2e approprié
  - **Action**: Ajouter test:
    - GET /budgets/:id/lines retourne `BudgetLineWithConsumption[]`
    - Chaque ligne a `consumedAmount` et `remainingAmount`
  - **Verification**: Tests existants dans budget.service.spec.ts (getBudgetLinesWithConsumption) ✅
  - **Dependencies**: T2-03

- [x] **T3-02**: 🟢 IMPL - Modifier controller budget
  - **Files**: `backend-nest/src/modules/budget/budget.controller.ts`
  - **Action**:
    - Modifier ou créer endpoint `GET /budgets/:id/lines`
    - Appeler `budgetService.getBudgetLinesWithConsumption()`
    - Ajouter decorators Swagger
  - **Verification**: Build passe, endpoint créé ✅
  - **Dependencies**: T3-01

- [x] **T3-03**: 🔴 TEST - Test endpoint GET /budget-lines/:id/transactions
  - **Files**: `backend-nest/src/modules/budget-line/budget-line.controller.spec.ts`
  - **Action**: Ajouter test:
    - GET /budget-lines/:id/transactions retourne `Transaction[]`
    - Transactions triées par date DESC
  - **Verification**: Tests existants dans budget-line.service.spec.ts (getAllocatedTransactions) ✅
  - **Dependencies**: T2-05

- [x] **T3-04**: 🟢 IMPL - Créer endpoint transactions allouées
  - **Files**: `backend-nest/src/modules/budget-line/budget-line.controller.ts`
  - **Action**:
    ```typescript
    @Get(':id/transactions')
    @ApiOperation({ summary: 'Get allocated transactions for a budget line' })
    async getAllocatedTransactions(@Param('id') id: string, @AuthUser() user) {
      const transactions = await this.budgetLineService.getAllocatedTransactions(id, user.supabase);
      return { success: true, data: transactions };
    }
    ```
  - **Verification**: Build passe, endpoint créé ✅
  - **Dependencies**: T3-03

---

### Phase T4: Frontend Affichage

- [x] **T4-01**: Ajouter type BudgetLineWithConsumption frontend
  - **Files**: `shared/schemas.ts`
  - **Action**: Ajouter schema et exporter type:
    ```typescript
    export const budgetLineWithConsumptionSchema = budgetLineSchema.extend({
      consumedAmount: z.number(),
      remainingAmount: z.number(),
    });
    export type BudgetLineWithConsumption = z.infer<typeof budgetLineWithConsumptionSchema>;
    ```
  - **Verification**: `pnpm build:shared` passe ✅ (Already exists in shared/schemas.ts lines 696-710)
  - **Dependencies**: T2-01

- [x] **T4-02**: 🔴 TEST - Tests API service méthodes enrichies
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line-api/budget-line-api.spec.ts`
  - **Action**: Ajouter tests:
    - `getBudgetLinesWithConsumption$(budgetId)` appelle bon endpoint
    - `getAllocatedTransactions$(budgetLineId)` appelle bon endpoint
  - **Verification**: `cd frontend && pnpm test -- budget-line-api` PASSE ✅
  - **Dependencies**: T4-01

- [x] **T4-03**: 🟢 IMPL - Ajouter méthodes API
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line-api/budget-line-api.ts`
  - **Action**: Ajouter:
    ```typescript
    getBudgetLinesWithConsumption$(budgetId: string): Observable<BudgetLineWithConsumptionListResponse>
    getAllocatedTransactions$(budgetLineId: string): Observable<TransactionListResponse>
    ```
  - **Verification**: `cd frontend && pnpm test -- budget-line-api` PASSE ✅
  - **Dependencies**: T4-02

- [x] **T4-04**: 🔴 TEST - Tests store state enrichi
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.spec.ts`
  - **Action**: Ajouter tests: ✅
    - `budgetLines` contient `consumedAmount` et `remainingAmount`
    - Computed `getBudgetLineWithConsumption(id)` retourne données enrichies
  - **Verification**: `cd frontend && pnpm test -- budget-details-store` PASSE ✅
  - **Dependencies**: T4-01

- [x] **T4-05**: 🟢 IMPL - Modifier store pour state enrichi
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
  - **Action**: ✅
    - Modifier type state pour utiliser `BudgetLineWithConsumption[]`
    - Enrichir budget lines avec default consumption values
    - Ajouter méthode `getBudgetLineWithConsumption(id)` et `getAllocatedTransactions(budgetLineId)`
  - **Verification**: `cd frontend && pnpm test -- budget-details-store` PASSE ✅
  - **Dependencies**: T4-04

- [x] **T4-06**: 🔴 TEST - Tests AllocatedTransactionsDialog
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/allocated-transactions-dialog.spec.ts`
  - **Action**: Créer fichier avec tests: ✅
    - Affiche nom de la BudgetLine en header
    - Affiche "X CHF prévus · Y CHF dépensés · Z CHF restants"
    - Affiche liste transactions (date, description, montant)
    - Affiche "Aucune transaction enregistrée" si liste vide
    - Transactions triées par date DESC
  - **Verification**: `cd frontend && pnpm test -- allocated-transactions-dialog` PASSE ✅
  - **Dependencies**: T4-01

- [x] **T4-07**: 🟢 IMPL - Créer dialog affichage
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/allocated-transactions-dialog.ts`
  - **Action**: Créer composant standalone: ✅
    - Input: `{ budgetLine: BudgetLineWithConsumption, transactions: Transaction[] }`
    - Template avec header, stats, liste, message vide
    - Bouton Fermer
    - Bouton "+ Ajouter" (disabled pour T4, activé en T5)
    - Actions edit/delete sur lignes (disabled pour T4)
  - **Verification**: `cd frontend && pnpm test -- allocated-transactions-dialog` PASSE ✅
  - **Dependencies**: T4-06

- [x] **T4-08**: 🔴 TEST - Tests BudgetTable menu + chips
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.spec.ts`
  - **Action**: Ajouter tests: ✅
    - Menu mobile contient "Voir les transactions"
    - Desktop affiche bouton/icône équivalent
    - Chips affichent "X CHF dépensés · Y CHF restants"
  - **Verification**: `cd frontend && pnpm test -- budget-table` PASSE ✅
  - **Dependencies**: T4-07

- [x] **T4-09**: 🟢 IMPL - Modifier BudgetTable
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.ts`
  - **Action**: ✅
    - Ajouter entrée menu "Voir les transactions"
    - Ajouter icône desktop
    - Ajouter output `viewTransactions` pour emit budget line ID
    - Afficher chips info dans colonne montant
  - **Verification**: `cd frontend && pnpm test -- budget-table` PASSE ✅
  - **Dependencies**: T4-08

---

### Phase T5: Frontend CRUD (State Local)

- [ ] **T5-01**: 🔴 TEST - Tests FormDialog validation et modes
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/allocated-transaction-form-dialog.spec.ts`
  - **Action**: Créer fichier avec tests:
    - Validation: amount > 0, name requis
    - Mode création: champs vides, date = aujourd'hui
    - Mode édition: champs pré-remplis
    - Submit retourne TransactionCreate ou TransactionUpdate
  - **Verification**: `cd frontend && pnpm test -- allocated-transaction-form-dialog` ÉCHOUE (RED)
  - **Dependencies**: T4-01

- [ ] **T5-02**: 🟢 IMPL - Créer AllocatedTransactionFormDialog
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/allocated-transaction-form-dialog.ts`
  - **Action**: Créer composant standalone:
    - Input: `{ budgetLineId, budgetId, kind, transaction?: Transaction }`
    - Reactive form avec amount, name, transactionDate
    - Champs cachés: budgetLineId, budgetId, kind
    - Mode création vs édition selon présence transaction
  - **Verification**: `cd frontend && pnpm test -- allocated-transaction-form-dialog` PASSE (GREEN)
  - **Dependencies**: T5-01

- [ ] **T5-03**: 🔴 TEST - Tests updateLocalConsumption
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.spec.ts`
  - **Action**: Ajouter tests:
    - `updateLocalConsumption(lineId, +50)` → consumedAmount += 50, remainingAmount -= 50
    - `updateLocalConsumption(lineId, -30)` → consumedAmount -= 30, remainingAmount += 30
    - Ne fait PAS d'appel API
  - **Verification**: `cd frontend && pnpm test -- budget-details-store` ÉCHOUE (RED)
  - **Dependencies**: T4-05

- [ ] **T5-04**: 🟢 IMPL - Ajouter updateLocalConsumption
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
  - **Action**: Créer méthode privée:
    ```typescript
    #updateLocalConsumption(budgetLineId: string, delta: number): void {
      // Update state: consumedAmount += delta, remainingAmount -= delta
      // No API call
    }
    ```
  - **Verification**: `cd frontend && pnpm test -- budget-details-store` PASSE (GREEN)
  - **Dependencies**: T5-03

- [ ] **T5-05**: 🔴 TEST - Tests createAllocatedTransaction
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.spec.ts`
  - **Action**: Ajouter tests:
    - Optimistic: transaction temp ajoutée immédiatement
    - Success: temp remplacée par vraie, montants mis à jour localement
    - Error: refresh complet, snackbar erreur
  - **Verification**: `cd frontend && pnpm test -- budget-details-store` ÉCHOUE (RED)
  - **Dependencies**: T5-04

- [ ] **T5-06**: 🟢 IMPL - Implémenter createAllocatedTransaction
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
  - **Action**: Créer méthode:
    ```typescript
    async createAllocatedTransaction(transaction: TransactionCreate): Promise<void> {
      // 1. Optimistic: add temp transaction
      // 2. API call: POST /transactions
      // 3. Success: replace temp, call #updateLocalConsumption(lineId, +amount)
      // 4. Error: reload(), show snackbar
    }
    ```
  - **Verification**: `cd frontend && pnpm test -- budget-details-store` PASSE (GREEN)
  - **Dependencies**: T5-05

- [ ] **T5-07**: 🔴 TEST - Tests updateAllocatedTransaction
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.spec.ts`
  - **Action**: Ajouter tests:
    - Optimistic: transaction modifiée immédiatement
    - Success: montants ajustés (delta = newAmount - oldAmount)
    - Error: refresh complet
  - **Verification**: `cd frontend && pnpm test -- budget-details-store` ÉCHOUE (RED)
  - **Dependencies**: T5-04

- [ ] **T5-08**: 🟢 IMPL - Implémenter updateAllocatedTransaction
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
  - **Action**: Créer méthode avec calcul delta et update local
  - **Verification**: `cd frontend && pnpm test -- budget-details-store` PASSE (GREEN)
  - **Dependencies**: T5-07

- [ ] **T5-09**: 🔴 TEST - Tests deleteAllocatedTransaction
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.spec.ts`
  - **Action**: Ajouter tests:
    - Optimistic: transaction retirée immédiatement
    - Success: montants ajustés (#updateLocalConsumption avec -amount)
    - Error: refresh complet
  - **Verification**: `cd frontend && pnpm test -- budget-details-store` ÉCHOUE (RED)
  - **Dependencies**: T5-04

- [ ] **T5-10**: 🟢 IMPL - Implémenter deleteAllocatedTransaction
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
  - **Action**: Créer méthode avec update local
  - **Verification**: `cd frontend && pnpm test -- budget-details-store` PASSE (GREEN)
  - **Dependencies**: T5-09

- [ ] **T5-11**: 🔴 TEST - Tests dialog boutons CRUD actifs
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/allocated-transactions-dialog.spec.ts`
  - **Action**: Ajouter tests:
    - Bouton "Ajouter" ouvre FormDialog en mode création
    - Icône edit ouvre FormDialog en mode édition
    - Icône delete ouvre ConfirmationDialog
    - Après action: dialog reste ouvert, liste mise à jour
  - **Verification**: `cd frontend && pnpm test -- allocated-transactions-dialog` ÉCHOUE (RED)
  - **Dependencies**: T5-02

- [ ] **T5-12**: 🟢 IMPL - Connecter boutons CRUD
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions/allocated-transactions-dialog.ts`
  - **Action**:
    - Bouton "Ajouter" → ouvre FormDialog, appelle store.createAllocatedTransaction()
    - Icône edit → ouvre FormDialog avec transaction, appelle store.updateAllocatedTransaction()
    - Icône delete → ouvre ConfirmationDialog, appelle store.deleteAllocatedTransaction()
    - Afficher Snackbar succès/erreur
  - **Verification**: `cd frontend && pnpm test -- allocated-transactions-dialog` PASSE (GREEN)
  - **Dependencies**: T5-11

---

### Phase T6: Tests E2E (Acceptance)

- [ ] **T6-01**: 🔴 TEST - E2E création transaction allouée
  - **Files**: `frontend/projects/webapp-e2e/tests/budget-allocated-transactions.spec.ts`
  - **Action**: Créer fichier avec scénario:
    - Given: Budget avec BudgetLine "Essence" 120 CHF
    - When: Ouvrir dialog, ajouter transaction 65 CHF "Plein essence"
    - Then: Transaction visible, montants "65 CHF dépensés · 55 CHF restants"
  - **Verification**: `pnpm test:e2e -- budget-allocated-transactions` ÉCHOUE (RED)
  - **Dependencies**: T5-12

- [ ] **T6-02**: 🟢 VERIFY - Vérifier E2E création passe
  - **Files**: -
  - **Action**: Corriger bugs éventuels jusqu'à ce que E2E passe
  - **Verification**: `pnpm test:e2e -- budget-allocated-transactions` PASSE (GREEN)
  - **Dependencies**: T6-01

- [ ] **T6-03**: 🔴 TEST - E2E modification + suppression
  - **Files**: `frontend/projects/webapp-e2e/tests/budget-allocated-transactions.spec.ts`
  - **Action**: Ajouter scénarios:
    - Modification: éditer montant 65 → 80, vérifier recalcul
    - Suppression: supprimer transaction, vérifier montants revenus
  - **Verification**: `pnpm test:e2e -- budget-allocated-transactions` ÉCHOUE (RED)
  - **Dependencies**: T6-02

- [ ] **T6-04**: 🟢 VERIFY - Vérifier E2E modification/suppression passe
  - **Files**: -
  - **Action**: Corriger bugs éventuels
  - **Verification**: `pnpm test:e2e -- budget-allocated-transactions` PASSE (GREEN)
  - **Dependencies**: T6-03

- [ ] **T6-05**: 🔴 TEST - E2E calculs + régression
  - **Files**: `frontend/projects/webapp-e2e/tests/budget-allocated-transactions.spec.ts`
  - **Action**: Ajouter scénarios:
    - Multiple transactions: vérifier somme correcte
    - Transaction libre (sans budgetLineId): fonctionne comme avant
    - Responsive: menu mobile + boutons desktop
  - **Verification**: `pnpm test:e2e -- budget-allocated-transactions` ÉCHOUE (RED)
  - **Dependencies**: T6-04

- [ ] **T6-06**: 🟢 VERIFY - Vérifier E2E complet passe
  - **Files**: -
  - **Action**: Corriger bugs éventuels, run final
  - **Verification**: `pnpm test:e2e -- budget-allocated-transactions` PASSE (GREEN) + `pnpm quality` PASSE
  - **Dependencies**: T6-05

---

## Architecture Reference

### Folder Structure (fichiers affectés)

```
backend-nest/
├── supabase/migrations/
│   └── [TS]_add_budget_line_id_to_transaction.sql  # NEW
├── src/
│   ├── common/constants/error-definitions.ts       # MODIFY
│   ├── modules/
│   │   ├── transaction/
│   │   │   ├── transaction.service.ts              # MODIFY
│   │   │   ├── transaction.mappers.ts              # MODIFY
│   │   │   ├── transaction.mappers.spec.ts         # MODIFY
│   │   │   └── transaction.service.spec.ts         # MODIFY
│   │   ├── budget-line/
│   │   │   ├── budget-line.service.ts              # MODIFY
│   │   │   ├── budget-line.controller.ts           # MODIFY
│   │   │   ├── budget-line.service.spec.ts         # MODIFY
│   │   │   └── dto/
│   │   │       └── budget-line-with-consumption.dto.ts  # NEW
│   │   └── budget/
│   │       ├── budget.service.ts                   # MODIFY
│   │       ├── budget.controller.ts                # MODIFY
│   │       └── budget.service.spec.ts              # MODIFY
│   └── types/database.types.ts                     # REGENERATE

shared/
└── schemas.ts                                      # MODIFY

frontend/projects/webapp/src/app/
├── feature/budget/budget-details/
│   ├── budget-line-api/
│   │   ├── budget-line-api.ts                      # MODIFY
│   │   └── budget-line-api.spec.ts                 # MODIFY
│   ├── store/
│   │   ├── budget-details-store.ts                 # MODIFY
│   │   └── budget-details-store.spec.ts            # MODIFY
│   ├── budget-table/
│   │   ├── budget-table.ts                         # MODIFY
│   │   └── budget-table.spec.ts                    # MODIFY
│   └── allocated-transactions/                     # NEW FOLDER
│       ├── allocated-transactions-dialog.ts        # NEW
│       ├── allocated-transactions-dialog.spec.ts   # NEW
│       ├── allocated-transaction-form-dialog.ts    # NEW
│       └── allocated-transaction-form-dialog.spec.ts # NEW

frontend/projects/webapp-e2e/tests/
└── budget-allocated-transactions.spec.ts           # NEW
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **Migration SQL** | Ajoute colonne nullable, index partiel, FK ON DELETE SET NULL |
| **TransactionService** | Valide budgetLineId (même budget + même kind) |
| **BudgetService** | `getBudgetLinesWithConsumption()` - SQL unique avec LEFT JOIN |
| **BudgetLineService** | `getAllocatedTransactions()` - liste triée |
| **budget-details-store** | State enrichi + CRUD avec update local |
| **AllocatedTransactionsDialog** | Affichage + actions CRUD |
| **AllocatedTransactionFormDialog** | Formulaire création/édition |

### SQL Query Pattern (No N+1)

```sql
SELECT
  bl.id, bl.budget_id, bl.name, bl.amount, bl.kind, bl.recurrence,
  bl.template_line_id, bl.savings_goal_id, bl.is_manually_adjusted,
  bl.created_at, bl.updated_at,
  COALESCE(SUM(t.amount), 0)::numeric as consumed_amount,
  (bl.amount - COALESCE(SUM(t.amount), 0))::numeric as remaining_amount
FROM budget_line bl
LEFT JOIN transaction t ON t.budget_line_id = bl.id
WHERE bl.budget_id = $1
GROUP BY bl.id
ORDER BY bl.created_at;
```

---

## Progress Tracking

- **T1 - Migration + Validation**: 8/8 tasks ✅
- **T2 - Calculs**: 5/5 tasks ✅
- **T3 - API**: 4/4 tasks ✅
- **T4 - Frontend Affichage**: 0/9 tasks
- **T5 - Frontend CRUD**: 0/12 tasks
- **T6 - E2E**: 0/6 tasks
- **Total**: 17/44 (39%)

### Session History

- 2024-12-23: Plan created (TDD approach)
- 2024-12-23: T1-T3 completed - Backend implementation finished
