import type {
  TemplateLine,
  TemplateLinesPropagationSummary,
} from 'pulpe-shared';
import type { TransactionFormData } from '../../services/transaction-form';

/**
 * Simplified editable line structure for template line editing
 */
export interface EditableLine {
  /**
   * Stable unique identifier for this editable line
   * - For existing lines: uses the originalLine.id
   * - For new lines: uses a generated UUID
   */
  id: string;

  /**
   * Current form data for the line
   */
  formData: TransactionFormData;

  /**
   * Whether this line has been modified from its original state
   */
  isModified: boolean;

  /**
   * Reference to the original template line (undefined for new lines)
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

  /**
   * Summary of propagation applied to budgets (if any)
   */
  propagation?: TemplateLinesPropagationSummary | null;
}
