import { type BudgetTemplate } from '@pulpe/shared';

/**
 * ViewModel interface for template display in the UI component.
 * Simplified structure focused on presentation needs.
 */
export interface TemplateViewModel {
  /** Original template data */
  template: BudgetTemplate;
  /** Total monthly income from template */
  totalIncome: number;
  /** Total monthly expenses + savings from template */
  totalExpenses: number;
  /** Remaining living allowance after expenses and savings */
  remainingLivingAllowance: number;
  /** Whether financial data is currently being loaded */
  loading: boolean;
}
