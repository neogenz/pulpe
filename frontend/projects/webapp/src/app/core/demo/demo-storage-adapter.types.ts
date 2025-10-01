import type {
  BudgetCreate,
  BudgetUpdate,
  TransactionCreate,
  TransactionUpdate,
  BudgetLineCreate,
  BudgetTemplateCreateTransactional,
  BudgetTemplateUpdate,
} from '@pulpe/shared';

/**
 * Types for DemoStorageAdapter method parameters
 *
 * These types are local to the demo feature and use/extend types from @pulpe/shared.
 * They are NOT shared across features (core/demo/ isolation).
 *
 * Architecture compliance:
 * - @pulpe/shared: Backend ↔ Frontend shared types (API contracts)
 * - core/demo/: Demo mode specific types (this file)
 */

// ============================================================================
// BUDGET TYPES
// ============================================================================

/**
 * Type for createBudget$() - identical to shared BudgetCreate
 */
export type DemoBudgetCreate = BudgetCreate;

/**
 * Type for updateBudget$() - identical to shared BudgetUpdate
 */
export type DemoBudgetUpdate = BudgetUpdate;

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

/**
 * Type for createTransaction$() - identical to shared TransactionCreate
 */
export type DemoTransactionCreate = TransactionCreate;

/**
 * Type for updateTransaction$() - identical to shared TransactionUpdate
 */
export type DemoTransactionUpdate = TransactionUpdate;

// ============================================================================
// BUDGET LINE TYPES
// ============================================================================

/**
 * Type for createBudgetLine$() - extends BudgetLineCreate with demo-specific rollover fields
 */
export type DemoBudgetLineCreate = BudgetLineCreate & {
  isRollover?: boolean;
  rolloverSourceBudgetId?: string | null;
};

/**
 * Type for updateBudgetLine$() - partial update without budgetId (passed separately)
 */
export interface DemoBudgetLineUpdate {
  name?: string;
  amount?: number;
  kind?: 'income' | 'expense' | 'saving';
  recurrence?: 'fixed' | 'one_off';
  isManuallyAdjusted?: boolean;
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

/**
 * Type for createTemplate$() - identical to shared BudgetTemplateCreateTransactional
 */
export type DemoTemplateCreate = BudgetTemplateCreateTransactional;

/**
 * Type for updateTemplate$() - identical to shared BudgetTemplateUpdate
 */
export type DemoTemplateUpdate = BudgetTemplateUpdate;

/**
 * Type for updateTemplateLines$() - bulk update of template lines
 */
export interface DemoTemplateLinesBulkUpdate {
  lines?: {
    id: string;
    name?: string;
    amount?: number;
    kind?: 'income' | 'expense' | 'saving';
    recurrence?: 'fixed' | 'one_off';
    description?: string;
  }[];
}

/**
 * Type for bulkOperationsTemplateLines$() - create/update/delete operations
 */
export interface DemoTemplateLinesBulkOperations {
  create?: {
    name: string;
    amount: number;
    kind: 'income' | 'expense' | 'saving';
    recurrence: 'fixed' | 'one_off';
    description: string;
  }[];
  update?: {
    id: string;
    name?: string;
    amount?: number;
    kind?: 'income' | 'expense' | 'saving';
    recurrence?: 'fixed' | 'one_off';
    description?: string;
  }[];
  delete?: string[];
}
