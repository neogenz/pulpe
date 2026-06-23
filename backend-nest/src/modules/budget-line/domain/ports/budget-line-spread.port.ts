import type { SupportedCurrency } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLine, SpreadDeleteSource } from '../budget-line.entity';
import type { Budget } from '../../../budget/domain/budget.entity';

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
 * quadruplet, mirroring `fx_metadata_coherent`). Mode-agnostic: callers compute
 * the tranches; this port only inserts them.
 */
export interface SpreadFanOutInput {
  name: string;
  kind: BudgetLine['kind'];
  tranches: SpreadTranche[];
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
}

export interface SpreadFanOutResult {
  spreadGroupId: string;
  lines: BudgetLine[];
  createdBudgets: Budget[];
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
