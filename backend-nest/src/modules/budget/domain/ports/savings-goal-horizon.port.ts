import type { BudgetPeriod } from 'pulpe-shared';

export const SAVINGS_GOAL_HORIZON_PORT = Symbol('SAVINGS_GOAL_HORIZON_PORT');

export interface MaterializedBudgetPeriod extends BudgetPeriod {
  id: string;
}

export interface SavingsGoalHorizonPort {
  goalIdsPastPeriod(period: BudgetPeriod): Promise<string[]>;
  periodsPastHorizon(
    goalIds: string[],
    periods: MaterializedBudgetPeriod[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
