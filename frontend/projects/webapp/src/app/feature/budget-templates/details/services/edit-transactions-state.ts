import type { TemplateLine } from '@pulpe/shared';
import type { TransactionFormData } from '../../services/transaction-form';

/**
 * Interface describing the state managed by EditTransactionsStore
 */
export interface EditTransactionsState {
  /**
   * Array of editable transactions being managed
   */
  transactions: EditableTransaction[];

  /**
   * Loading state for async operations
   */
  isLoading: boolean;

  /**
   * Error state for failed operations
   */
  error: string | null;
}

/**
 * Editable transaction data structure
 */
export interface EditableTransaction {
  /**
   * Unique identifier - either original line ID or generated temp ID
   */
  id: string;

  /**
   * Form data for the transaction
   */
  formData: TransactionFormData;

  /**
   * Whether this is a new transaction (not yet saved)
   */
  isNew: boolean;

  /**
   * Whether this transaction has been marked for deletion
   */
  isDeleted: boolean;

  /**
   * Reference to the original template line if this was created from one
   */
  originalLine?: TemplateLine;
}

/**
 * Result of save operation
 */
export interface SaveResult {
  /**
   * Whether the save operation was successful
   */
  success: boolean;

  /**
   * Template lines that were created or updated (not all lines)
   */
  updatedLines?: TemplateLine[];

  /**
   * IDs of template lines that were deleted
   */
  deletedIds?: string[];

  /**
   * Error message if save failed
   */
  error?: string;
}

/**
 * Factory function to create initial state
 */
export function createInitialEditTransactionsState(): EditTransactionsState {
  return {
    transactions: [],
    isLoading: false,
    error: null,
  };
}
