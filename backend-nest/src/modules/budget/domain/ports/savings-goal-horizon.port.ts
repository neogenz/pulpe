import type { BudgetPeriod } from 'pulpe-shared';

export const SAVINGS_GOAL_HORIZON_PORT = Symbol('SAVINGS_GOAL_HORIZON_PORT');

export interface MaterializedBudgetPeriod extends BudgetPeriod {
  id: string;
}

export interface SavingsGoalHorizonPort {
  goalIdsExcludedFromPeriod(period: BudgetPeriod): Promise<string[]>;
  periodsOutsideInterval(
    goalIds: string[],
    periods: MaterializedBudgetPeriod[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
