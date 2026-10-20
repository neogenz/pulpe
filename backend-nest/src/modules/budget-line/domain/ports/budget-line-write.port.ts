import type { BudgetLineCreate, BudgetLineUpdate } from 'pulpe-shared';
import type { BudgetLine } from '../budget-line.entity';
import type { SpreadFanOutResult } from './budget-line-spread.port';

export const BUDGET_LINE_WRITE_PORT = Symbol('BUDGET_LINE_WRITE_PORT');

/**
 * The everyday gestures on a prévision, for in-process consumers (the MCP agent
 * connector). Requires the caller to have put `user` and `supabase` in CLS,
 * exactly like an HTTP request does.
 */
export interface BudgetLineWritePort {
  create(dto: BudgetLineCreate): Promise<BudgetLine>;
  /**
   * An agent edit of a value field marks the line `isManuallyAdjusted`
   * (BUSINESS_RULES: no longer overwritten by Mois Type propagation); a
   * tags-only patch does not.
   */
  update(id: string, patch: BudgetLineUpdate): Promise<BudgetLine>;
  /** Pointe ou dépointe : le même geste dans les deux sens. */
  toggleCheck(id: string): Promise<BudgetLine>;
  /** Lisse une prévision existante sur les mois donnés. */
  spread(
    id: string,
    periods: { month: number; year: number }[],
  ): Promise<SpreadFanOutResult>;
}
