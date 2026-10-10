import { Inject, Injectable } from '@nestjs/common';
import type {
  TransactionImportError,
  TransactionImportPreview,
} from 'pulpe-shared';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '@modules/user/domain/ports/user-repository.port';
import {
  type BankStatement,
  MalformedStatementError,
} from '../domain/bank-statement.entity';
import {
  STATEMENT_PARSERS,
  type StatementParser,
} from '../domain/ports/statement-parser.port';
import {
  TRANSACTION_IMPORT_REPOSITORY,
  type TransactionImportRepositoryPort,
} from '../domain/ports/transaction-import-repository.port';
import type {
  AttachableLine,
  ImportCandidate,
} from '../domain/transaction-import.entity';
import {
  budgetPeriodBounds,
  classifyOperations,
  findStatementErrors,
  fingerprintMaterials,
  validateOperations,
} from '../domain/transaction-import.formulas';

export interface TransactionImportAnalysis {
  preview: TransactionImportPreview;
  /** What a confirmation would write; meaningless while `preview.errors` is non-empty. */
  candidates: ImportCandidate[];
  /** The Prévisions a candidate may be attached to. */
  lines: AttachableLine[];
}

/**
 * Turns a raw bank file into what the user sees and what the confirmation
 * writes. Preview and confirmation both run it, so the confirmation never
 * trusts anything the client sends back but the file itself.
 */
@Injectable()
export class TransactionImportAnalyzer {
  constructor(
    @Inject(STATEMENT_PARSERS)
    private readonly parsers: readonly StatementParser[],
    @Inject(TRANSACTION_IMPORT_REPOSITORY)
    private readonly repo: TransactionImportRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
    @InjectInfoLogger(TransactionImportAnalyzer.name)
    private readonly logger: InfoLogger,
  ) {}

  async analyze(
    content: string,
    budgetId: string,
  ): Promise<TransactionImportAnalysis> {
    // The budget lookup doubles as the ownership check: it runs first, so the
    // Prévisions are never read for a budget that is not the caller's.
    const budget = await this.repo.findTargetBudget(budgetId);
    const [settings, lines] = await Promise.all([
      this.users.findSettings(),
      this.repo.findAttachableLines(budget.id),
    ]);
    const budgetLines = lines.map(({ id, name, kind, amount }) => ({
      id,
      name,
      kind,
      amount,
    }));
    const period = budgetPeriodBounds(
      budget.month,
      budget.year,
      settings.payDayOfMonth,
    );
    const rejected = (
      format: TransactionImportPreview['format'],
      errors: TransactionImportError[],
    ): TransactionImportAnalysis => ({
      preview: {
        format,
        period,
        currency: settings.currency,
        operations: [],
        errors,
        budgetLines,
      },
      candidates: [],
      lines,
    });

    const parser = this.parsers.find((candidate) => candidate.accepts(content));
    if (!parser) {
      return rejected(null, [{ code: 'unsupported_format', position: null }]);
    }

    const statement = this.parse(parser, content, budgetId);
    if (!statement) {
      return rejected(parser.format, [
        { code: 'malformed_file', position: null },
      ]);
    }

    const statementErrors = findStatementErrors(statement);
    if (statementErrors.length > 0) {
      return rejected(parser.format, statementErrors);
    }

    const { valid, errors } = validateOperations(
      statement.operations,
      settings.currency,
    );
    const fingerprints = this.repo.fingerprint(
      fingerprintMaterials(statement.format, valid),
    );
    const { operations, candidates } = classifyOperations({
      operations: valid,
      fingerprints,
      importedFingerprints:
        await this.repo.findImportedFingerprints(fingerprints),
      period,
      lines,
    });

    return {
      preview: {
        format: parser.format,
        period,
        currency: settings.currency,
        operations,
        errors,
        budgetLines,
      },
      candidates,
      lines,
    };
  }

  private parse(
    parser: StatementParser,
    content: string,
    budgetId: string,
  ): BankStatement | null {
    try {
      return parser.parse(content);
    } catch (error) {
      if (!(error instanceof MalformedStatementError)) throw error;
      // The reason names a structural problem, never the file's content.
      this.logger.warn(
        {
          operation: 'transactionImport.parse',
          format: parser.format,
          budgetId,
          reason: error.message,
        },
        'Bank export could not be parsed',
      );
      return null;
    }
  }
}
