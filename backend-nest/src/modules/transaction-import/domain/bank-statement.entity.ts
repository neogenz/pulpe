import type { TransactionImportFormat } from 'pulpe-shared';

export type ImportedKind = 'income' | 'expense';

/**
 * One operation as read from the bank file, before any validation. Every
 * field the file may omit or garble is nullable: the parser reports what it
 * saw, the domain decides whether that is acceptable.
 */
export interface StatementOperation {
  /** 1-based rank in the file, across every statement it contains. */
  position: number;
  /** ISO calendar date (YYYY-MM-DD); booking date, else value date. */
  date: string | null;
  /** Positive amount as written in the file; null when unreadable. */
  amount: number | null;
  currency: string | null;
  /** Money in (`income`) or out (`expense`); null when the file does not say. */
  direction: ImportedKind | null;
  label: string | null;
  /** False while the bank still shows the operation as pending. */
  isBooked: boolean;
  /** Reference the bank assigns to the operation, stable across exports. */
  bankReference: string | null;
}

export interface BankStatement {
  format: TransactionImportFormat;
  /** Account identifier (IBAN when given); only ever used inside fingerprints. */
  accountId: string | null;
  operations: StatementOperation[];
}

/** The file looks like the format but cannot be read as such. */
export class MalformedStatementError extends Error {
  constructor(reason: string, options?: { cause?: unknown }) {
    super(`Malformed bank statement: ${reason}`, options);
    this.name = 'MalformedStatementError';
  }
}
