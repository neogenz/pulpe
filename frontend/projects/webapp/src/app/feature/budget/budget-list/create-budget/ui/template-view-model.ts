import { type BudgetTemplate } from '@pulpe/shared';

/**
 * ViewModel interface for template display in the UI component.
 * Follows SPECS.md vocabulary: income, expenses (including savings), and net balance.
 */
export interface TemplateViewModel {
  /** Original template data */
  template: BudgetTemplate;
  /** Total monthly income from template lines */
  income: number;
  /** Total monthly expenses including savings (as per SPECS: savings are treated as expenses) */
  expenses: number;
  /** Net balance: income - expenses (can be negative) */
  netBalance: number;
  /** Whether financial data is currently being loaded */
  loading: boolean;
}
