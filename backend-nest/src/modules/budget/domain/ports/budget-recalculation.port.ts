export const BUDGET_RECALCULATION_PORT = Symbol('BUDGET_RECALCULATION_PORT');

export interface BudgetRecalculationPort {
  recalculate(budgetId: string): Promise<void>;
}
