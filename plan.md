---
title: Implementation Plan - Budget Details Store Refactoring
description: Refactor budget-details-store to fix hasValue() guard, reduce file length, and extract cascade logic
status: in_progress
created: 2025-12-31
updated: 2025-12-31
progress: 0
total_tasks: 9
tech_stack: Angular 21+, TypeScript, Signals, Vitest
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

- ✅ Follow instructions exactly
- ✅ Respect dependencies
- ❌ Never install unlisted libraries
- ❌ Never skip tasks or change order

---

# Implementation Plan: Budget Details Store Refactoring

## Overview

Refactor `budget-details-store.ts` to address three code quality issues:

1. Missing `hasValue()` guard in computed signals (use idiomatic Angular resource pattern)
2. File exceeds 300 line limit (598 lines → target ≤280 lines)
3. Complex toggle methods exceed 30 line limit (extract cascade logic to pure functions)

## Context

- **Tech Stack**: Angular 20+, TypeScript strict, Signals, Vitest
- **Architecture**: Feature-scoped store with resource() for async, computed() for derived state
- **Constraints**:
  - Preserve public API (no breaking changes for consumers)
  - Existing tests must pass without modification
  - Follow `BudgetFormulas` pattern for pure helper functions

---

## Prerequisites (Human Required)

- [x] No external configuration needed

---

## Implementation Tasks

### Phase: Setup

- [ ] **SETUP-01**: Create utils file with type definitions
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-check.utils.ts`
  - **Action**:
    1. Create new file
    2. Add imports: `import type { BudgetLine, Transaction } from '@pulpe/shared';`
    3. Define interfaces:

       ```typescript
       export interface CascadeContext {
         budgetLines: BudgetLine[];
         transactions: Transaction[];
       }

       export interface BudgetLineToggleResult {
         isChecking: boolean;
         updatedBudgetLines: BudgetLine[];
         updatedTransactions: Transaction[];
         transactionsToToggle: Transaction[];
       }

       export interface TransactionToggleResult {
         isChecking: boolean;
         updatedBudgetLines: BudgetLine[];
         updatedTransactions: Transaction[];
         shouldToggleBudgetLine: boolean;
         budgetLineId: string | null;
       }
       ```

  - **Verification**: `pnpm run lint` passes
  - **Dependencies**: None

---

### Phase: Core

- [ ] **CORE-01**: Extract `findAllocatedTransactions` helper
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-check.utils.ts`
  - **Action**: Add pure function:
    ```typescript
    /**
     * Find all transactions allocated to a specific budget line
     */
    export function findAllocatedTransactions(
      budgetLineId: string,
      transactions: Transaction[]
    ): Transaction[] {
      return transactions.filter((tx) => tx.budgetLineId === budgetLineId);
    }
    ```
  - **Verification**: `pnpm run lint` passes
  - **Dependencies**: SETUP-01

- [ ] **CORE-02**: Extract `areAllAllocatedTransactionsChecked` helper
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-check.utils.ts`
  - **Action**: Add pure function:
    ```typescript
    /**
     * Check if all transactions allocated to a budget line are checked
     */
    export function areAllAllocatedTransactionsChecked(
      budgetLineId: string,
      transactions: Transaction[]
    ): boolean {
      const allocated = findAllocatedTransactions(budgetLineId, transactions);
      return (
        allocated.length > 0 && allocated.every((tx) => tx.checkedAt !== null)
      );
    }
    ```
  - **Verification**: `pnpm run lint` passes
  - **Dependencies**: CORE-01

- [ ] **CORE-03**: Extract `calculateBudgetLineToggle` function
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-check.utils.ts`
  - **Action**: Add pure function that encapsulates cascade logic from `toggleCheck` method:

    ```typescript
    /**
     * Calculate the optimistic state when toggling a budget line's checked status.
     * Cascades to allocated transactions: checking checks all unchecked, unchecking unchecks all checked.
     */
    export function calculateBudgetLineToggle(
      budgetLineId: string,
      context: CascadeContext
    ): BudgetLineToggleResult | null {
      const budgetLine = context.budgetLines.find(
        (line) => line.id === budgetLineId
      );
      if (!budgetLine) return null;

      const isChecking = budgetLine.checkedAt === null;
      const now = new Date().toISOString();
      const allocatedTransactions = findAllocatedTransactions(
        budgetLineId,
        context.transactions
      );

      // Transactions to toggle: unchecked when checking, checked when unchecking
      const transactionsToToggle = allocatedTransactions.filter((tx) =>
        isChecking ? tx.checkedAt === null : tx.checkedAt !== null
      );

      const updatedBudgetLines = context.budgetLines.map((line) =>
        line.id === budgetLineId
          ? { ...line, checkedAt: isChecking ? now : null, updatedAt: now }
          : line
      );

      const updatedTransactions = context.transactions.map((tx) =>
        tx.budgetLineId === budgetLineId
          ? { ...tx, checkedAt: isChecking ? now : null, updatedAt: now }
          : tx
      );

      return {
        isChecking,
        updatedBudgetLines,
        updatedTransactions,
        transactionsToToggle,
      };
    }
    ```

  - **Verification**: `pnpm run lint` passes
  - **Dependencies**: CORE-01, CORE-02

- [ ] **CORE-04**: Extract `calculateTransactionToggle` function
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-check.utils.ts`
  - **Action**: Add pure function that encapsulates cascade logic from `toggleTransactionCheck` method:

    ```typescript
    /**
     * Calculate the optimistic state when toggling a transaction's checked status.
     * Cascades to parent budget line:
     * - Unchecking a transaction unchecks the parent budget line
     * - Checking all allocated transactions checks the parent budget line
     */
    export function calculateTransactionToggle(
      transactionId: string,
      context: CascadeContext
    ): TransactionToggleResult | null {
      const transaction = context.transactions.find(
        (tx) => tx.id === transactionId
      );
      if (!transaction) return null;

      const isChecking = transaction.checkedAt === null;
      const now = new Date().toISOString();
      const budgetLineId = transaction.budgetLineId;

      // Update the transaction
      const updatedTransactions = context.transactions.map((tx) =>
        tx.id === transactionId
          ? { ...tx, checkedAt: isChecking ? now : null, updatedAt: now }
          : tx
      );

      let updatedBudgetLines = context.budgetLines;
      let shouldToggleBudgetLine = false;

      if (budgetLineId) {
        const budgetLine = context.budgetLines.find(
          (line) => line.id === budgetLineId
        );

        if (!isChecking && budgetLine?.checkedAt !== null) {
          // Unchecking transaction → uncheck parent budget line
          updatedBudgetLines = context.budgetLines.map((line) =>
            line.id === budgetLineId
              ? { ...line, checkedAt: null, updatedAt: now }
              : line
          );
          shouldToggleBudgetLine = true;
        } else if (isChecking) {
          // Checking transaction → check if all allocated transactions will be checked
          const allChecked = areAllAllocatedTransactionsChecked(
            budgetLineId,
            updatedTransactions
          );
          if (allChecked && budgetLine?.checkedAt === null) {
            updatedBudgetLines = context.budgetLines.map((line) =>
              line.id === budgetLineId
                ? { ...line, checkedAt: now, updatedAt: now }
                : line
            );
            shouldToggleBudgetLine = true;
          }
        }
      }

      return {
        isChecking,
        updatedBudgetLines,
        updatedTransactions,
        shouldToggleBudgetLine,
        budgetLineId,
      };
    }
    ```

  - **Verification**: `pnpm run lint` passes
  - **Dependencies**: CORE-01, CORE-02

---

### Phase: Integration

- [ ] **INT-01**: Fix `hasValue()` guard in `realizedBalance` computed
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
  - **Action**: Update `realizedBalance` computed signal (around line 104-112):

    ```typescript
    // BEFORE:
    readonly realizedBalance = computed<number>(() => {
      const details = this.budgetDetails();
      if (!details) return 0;
      return BudgetFormulas.calculateRealizedBalance(
        this.displayBudgetLines(),
        details.transactions,
      );
    });

    // AFTER:
    readonly realizedBalance = computed<number>(() => {
      if (!this.#budgetDetailsResource.hasValue()) return 0;
      const details = this.#budgetDetailsResource.value();
      return BudgetFormulas.calculateRealizedBalance(
        this.displayBudgetLines(),
        details.transactions,
      );
    });
    ```

  - **Verification**: `pnpm run lint` passes
  - **Dependencies**: None

- [ ] **INT-02**: Refactor `toggleCheck` method to use utils
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
  - **Action**:
    1. Add import: `import { calculateBudgetLineToggle } from './budget-details-check.utils';`
    2. Replace `toggleCheck` method (keep rollover handling intact):

    ```typescript
    /**
     * Toggle the checked state of a budget line
     * For rollover lines (virtual), only updates local state without API call
     * Cascades to allocated transactions: checking checks all, unchecking unchecks all
     */
    async toggleCheck(id: string): Promise<void> {
      // Handle virtual rollover line - local state only, no API call
      if (id === 'rollover-display') {
        const currentCheckedAt = this.#state.rolloverCheckedAt();
        this.#state.rolloverCheckedAt.set(
          currentCheckedAt === null ? new Date().toISOString() : null,
        );
        return;
      }

      const details = this.budgetDetails();
      if (!details) return;

      const result = calculateBudgetLineToggle(id, {
        budgetLines: details.budgetLines,
        transactions: details.transactions ?? [],
      });

      if (!result) return;

      // Optimistic update
      this.#budgetDetailsResource.update((d) => {
        if (!d) return d;
        return {
          ...d,
          budgetLines: result.updatedBudgetLines,
          transactions: result.updatedTransactions,
        };
      });

      try {
        // Toggle budget line
        const response = await firstValueFrom(
          this.#budgetLineApi.toggleCheck$(id),
        );

        // Toggle allocated transactions that need to change
        await Promise.all(
          result.transactionsToToggle.map((tx) =>
            firstValueFrom(this.#transactionApi.toggleCheck$(tx.id)),
          ),
        );

        // Update with server response
        this.#budgetDetailsResource.update((d) => {
          if (!d) return d;
          return {
            ...d,
            budgetLines: d.budgetLines.map((line) =>
              line.id === id ? response.data : line,
            ),
          };
        });

        this.#clearError();
      } catch (error) {
        this.reloadBudgetDetails();
        this.#setError('Erreur lors du basculement du statut de la prévision');
        this.#logger.error('Error toggling budget line check', error);
      }
    }
    ```

  - **Verification**: `pnpm run lint` passes
  - **Dependencies**: CORE-03

- [ ] **INT-03**: Refactor `toggleTransactionCheck` method to use utils
  - **Files**: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
  - **Action**:
    1. Add to existing import: `import { calculateBudgetLineToggle, calculateTransactionToggle } from './budget-details-check.utils';`
    2. Replace `toggleTransactionCheck` method:

    ```typescript
    /**
     * Toggle the checked state of a transaction
     * Uses optimistic update for instant UI feedback with rollback on error
     * When unchecking a transaction, unchecks the parent budget line
     * When all allocated transactions are checked, checks the parent budget line
     */
    async toggleTransactionCheck(id: string): Promise<void> {
      const details = this.budgetDetails();
      if (!details) return;

      const result = calculateTransactionToggle(id, {
        budgetLines: details.budgetLines,
        transactions: details.transactions ?? [],
      });

      if (!result) return;

      // Optimistic update
      this.#budgetDetailsResource.update((d) => {
        if (!d) return d;
        return {
          ...d,
          budgetLines: result.updatedBudgetLines,
          transactions: result.updatedTransactions,
        };
      });

      try {
        // Toggle transaction
        const response = await firstValueFrom(
          this.#transactionApi.toggleCheck$(id),
        );

        // Handle cascading budget line update if needed
        if (result.shouldToggleBudgetLine && result.budgetLineId) {
          await firstValueFrom(
            this.#budgetLineApi.toggleCheck$(result.budgetLineId),
          );
        }

        // Update with server response
        this.#budgetDetailsResource.update((d) => {
          if (!d) return d;
          return {
            ...d,
            transactions: (d.transactions ?? []).map((tx) =>
              tx.id === id ? response.data : tx,
            ),
          };
        });

        this.#clearError();
      } catch (error) {
        this.reloadBudgetDetails();
        this.#setError('Erreur lors du basculement du statut de la transaction');
        this.#logger.error('Error toggling transaction check', error);
      }
    }
    ```

  - **Verification**: `pnpm run lint` passes
  - **Dependencies**: CORE-04

---

### Phase: Testing

- [ ] **TEST-01**: Verify all tests pass and file metrics
  - **Files**: All modified files
  - **Action**:
    1. Run unit tests: `cd frontend && pnpm run test`
    2. Run linting: `pnpm run lint`
    3. Count lines in store: `wc -l projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
       - Expected: ≤300 lines
    4. Count lines in utils: `wc -l projects/webapp/src/app/feature/budget/budget-details/store/budget-details-check.utils.ts`
       - Expected: ≤150 lines
    5. Manual test in UI:
       - Toggle a budget line → verify allocated transactions cascade
       - Toggle a transaction → verify parent budget line cascades appropriately
  - **Verification**: All tests green, lint passes, line counts within limits, UI behavior unchanged
  - **Dependencies**: INT-01, INT-02, INT-03

---

## Architecture Reference

### Folder Structure (After Refactoring)

```
frontend/projects/webapp/src/app/feature/budget/budget-details/store/
├── budget-details-store.ts              # Main store (~280 lines)
├── budget-details-state.ts              # State interface (unchanged)
├── budget-details-check.utils.ts        # NEW: Pure cascade logic (~120 lines)
├── budget-details-store.spec.ts         # Unit tests (unchanged)
└── budget-details-store-integration.spec.ts  # Integration tests (unchanged)
```

### Key Components

- **BudgetDetailsStore**: Signal-based store managing budget details, CRUD operations, and toggle state
- **budget-details-check.utils.ts**: Pure functions for cascade toggle logic (no Angular dependencies)
- **BudgetFormulas** (from @pulpe/shared): Existing pattern for pure calculation functions

### Design Principles

- **Pure functions**: Cascade logic extracted as pure functions for testability
- **Single responsibility**: Store orchestrates, utils calculate
- **Immutability**: All state updates create new references
- **Optimistic updates**: UI updates immediately, rollback on error

---

## Progress Tracking

- **Setup**: 0/1 tasks
- **Core**: 0/4 tasks
- **Integration**: 0/3 tasks
- **Testing**: 0/1 tasks
- **Total**: 0/9 (0%)

### Session History

- 2025-12-31: Plan created
