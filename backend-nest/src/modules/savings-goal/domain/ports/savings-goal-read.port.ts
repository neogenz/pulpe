import type {
  SavingsGoal,
  SavingsGoalProgressComputation,
} from '../savings-goal.entity';

export const SAVINGS_GOAL_READ_PORT = Symbol('SAVINGS_GOAL_READ_PORT');

/**
 * Read the user's savings goals and their projection, for in-process consumers
 * (the MCP agent connector). Requires the caller to have put `user` and
 * `supabase` in CLS, exactly like an HTTP request does.
 */
export interface SavingsGoalReadPort {
  list(): Promise<SavingsGoal[]>;
  /** Throws SAVINGS_GOAL_NOT_FOUND for a missing or foreign goal. */
  outlook(goalId: string): Promise<SavingsGoalProgressComputation>;
}
