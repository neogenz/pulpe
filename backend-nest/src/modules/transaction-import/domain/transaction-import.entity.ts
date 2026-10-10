import type { TransactionKind } from 'pulpe-shared';
import type { ImportedKind } from './bank-statement.entity';

export interface ImportTargetBudget {
  id: string;
  month: number;
  year: number;
}

/** Inclusive calendar bounds of a budget period (YYYY-MM-DD). */
export interface ImportPeriod {
  startDate: string;
  endDate: string;
}

/**
 * A Prévision of the target budget an imported operation may be attached to.
 * Withdrawals from a savings goal are never part of it: their Réels go through
 * the goal's balance check, which an import does not run.
 */
export interface AttachableLine {
  id: string;
  name: string;
  kind: TransactionKind;
  amount: number;
}

/** A validated `new` operation of the file, before the user's decisions. */
export interface ImportCandidate {
  position: number;
  /** ISO calendar date (YYYY-MM-DD). */
  date: string;
  name: string;
  amount: number;
  kind: ImportedKind;
  fingerprint: string;
}

/**
 * What the confirmation writes for one candidate: a free Réel, or one the user
 * explicitly attached to a Prévision — which then takes the Prévision's kind
 * and is checked.
 */
export interface PlannedImport extends Omit<ImportCandidate, 'kind'> {
  kind: TransactionKind;
  budgetLineId: string | null;
  /** ISO timestamp when attached (CA6: only accepted attachments are checked). */
  checkedAt: string | null;
}
