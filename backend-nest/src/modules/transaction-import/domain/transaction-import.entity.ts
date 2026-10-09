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

/** A validated operation the confirmation will write as a Réel. */
export interface ImportCandidate {
  position: number;
  /** ISO calendar date (YYYY-MM-DD). */
  date: string;
  name: string;
  amount: number;
  kind: ImportedKind;
  fingerprint: string;
}
