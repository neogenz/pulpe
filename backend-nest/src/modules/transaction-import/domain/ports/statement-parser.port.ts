import type { TransactionImportFormat } from 'pulpe-shared';
import type { BankStatement } from '../bank-statement.entity';

/** Every registered parser, tried in order: a new format is one more entry. */
export const STATEMENT_PARSERS = Symbol('STATEMENT_PARSERS');

export interface StatementParser {
  readonly format: TransactionImportFormat;
  /** Cheap sniff of the raw text; true means "this file claims to be mine". */
  accepts(content: string): boolean;
  /** Throws `MalformedStatementError` when the file cannot be read. */
  parse(content: string): BankStatement;
}
