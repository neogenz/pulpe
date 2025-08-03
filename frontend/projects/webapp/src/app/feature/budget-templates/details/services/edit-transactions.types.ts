import type {
  TemplateLine,
  TemplateLineCreateWithoutTemplateId,
  TemplateLineUpdateWithId,
} from '@pulpe/shared';
import type { TransactionFormData } from '../../services/transaction-form';

/**
 * Represents an editable transaction that can be new, existing, or marked for deletion
 */
export interface EditableTransaction {
  /** Unique identifier for the transaction (existing line ID or temporary ID for new transactions) */
  id: string;
  /** Form data for the transaction */
  formData: TransactionFormData;
  /** Whether this is a newly added transaction */
  isNew: boolean;
  /** Whether this transaction is marked for deletion */
  isDeleted: boolean;
  /** Reference to the original template line (undefined for new transactions) */
  originalLine?: TemplateLine;
}

/**
 * Bulk operations to be sent to the API
 */
export interface EditTransactionsOperations {
  /** New transactions to create */
  create: TemplateLineCreateWithoutTemplateId[];
  /** Existing transactions to update */
  update: TemplateLineUpdateWithId[];
  /** IDs of transactions to delete */
  delete: string[];
}

/**
 * Result of a save operation
 */
export interface SaveResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Updated template lines (created + updated) */
  updatedLines?: TemplateLine[];
  /** Error message if the operation failed */
  error?: string;
}

/**
 * State for tracking changes during editing
 */
export interface EditTransactionsInternalState {
  /** All transactions (including deleted ones) */
  transactions: EditableTransaction[];
  /** Whether a save operation is in progress */
  isLoading: boolean;
  /** Current error message */
  error: string | null;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
}
