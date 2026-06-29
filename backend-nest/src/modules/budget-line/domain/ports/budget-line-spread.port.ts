import type { SupportedCurrency } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLine, SpreadDeleteSource } from '../budget-line.entity';

export const BUDGET_LINE_SPREAD_PORT = Symbol('BUDGET_LINE_SPREAD_PORT');

/**
 * One concrete monthly tranche of a spread fan-out. Amounts are PLAIN numbers
 * (the repository owns the encryption boundary). `originalAmount` is present
 * only when the source carries frozen FX metadata.
 */
export interface SpreadTranche {
  year: number;
  month: number;
  amount: number;
  originalAmount?: number | null;
}

/**
 * Inputs for the reusable fan-out: a name/kind, the concrete tranches, and the
 * frozen FX metadata (all-or-nothing — either none, target-only, or the full
 * quadruplet, mirroring `fx_metadata_coherent`). Mode-agnostic: callers supply
 * concrete tranches (the additive flow builds them from the per-month intent;
 * the spread-from flows split a total); this port only inserts them.
 */
export interface SpreadFanOutInput {
  name: string;
  kind: BudgetLine['kind'];
  tranches: SpreadTranche[];
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  /**
   * PUL-17 idempotency key (additive create flow only). When the client supplies
   * it, it becomes the `spread_group_id` AND opts this fan-out into REPLAY: a
   * retry with the same key returns the existing group instead of duplicating it.
   * Absent → the server generates a fresh key (no replay). The total-preserving
   * spread-from flows never set it: they are already retry-safe via source
   * consumption (the source DELETE serializes concurrent calls).
   */
  spreadGroupId?: string;
}

export interface SpreadFanOutBudget {
  id: string;
  userId: string | null;
  templateId: string;
  month: number;
  year: number;
  description: string;
  endingBalance: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpreadFanOutResult {
  spreadGroupId: string;
  lines: BudgetLine[];
  createdBudgets: SpreadFanOutBudget[];
  /** Periods with no budget and no default template (caller decides tolerance). */
  skippedMonths: { month: number; year: number }[];
}

/**
 * PUL-17 v1.1 — the reusable budget-line fan-out behind a port so cross-module
 * consumers (the transaction spread-from flow) can drive it WITHOUT importing
 * the concrete use case (ADR-0002). Provisions missing budgets from the default
 * template, inserts N `one_off` sibling lines sharing one `spread_group_id`,
 * recalculates each touched budget, and invalidates the user cache once.
 */
export interface BudgetLineSpreadPort {
  /**
   * TOLERANT fan-out (additive create flow): a month with no default template
   * lands in `skippedMonths` and receives no line — the rest still persist.
   */
  fanOut(
    input: SpreadFanOutInput,
    user: AuthenticatedUser,
  ): Promise<SpreadFanOutResult>;
  /**
   * STRICT fan-out (total-preserving spread-from flows): if ANY requested month
   * cannot be provisioned, the whole operation fails BEFORE inserting a single
   * line (Σ=T forbids silently dropping a month). Never partial-creates lines.
   *
   * `source` (PUL-17 v1.1 Defect 2) is the existing entity the spread replaces;
   * its deletion is folded INTO the same all-or-nothing RPC as the insert, so a
   * fan-out failure leaves the source intact with nothing created (no double-count,
   * no money loss, no duplicate-on-retry).
   */
  fanOutStrict(
    input: SpreadFanOutInput,
    user: AuthenticatedUser,
    source: SpreadDeleteSource,
  ): Promise<SpreadFanOutResult>;
}
