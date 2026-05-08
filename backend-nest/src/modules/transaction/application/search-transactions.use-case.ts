import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  type TransactionSearchResult,
  type TransactionKind,
} from 'pulpe-shared';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import type {
  TransactionSearchTransactionRow,
  TransactionSearchBudgetLineRow,
} from '../domain/transaction.entity';

const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

@Injectable()
export class SearchTransactionsUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    @InjectInfoLogger(SearchTransactionsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    query: string,
    user: AuthenticatedUser,
    years?: number[],
  ): Promise<TransactionSearchResult[]> {
    const searchPattern = this.buildSearchPattern(query);

    const budgetIds = years?.length
      ? await this.repo.fetchBudgetIdsByYears(user.id, years)
      : null;

    if (years?.length && budgetIds?.length === 0) {
      return [];
    }

    const [transactions, budgetLines] = await Promise.all([
      this.repo.fetchTransactionsByPattern(searchPattern, budgetIds),
      this.repo.fetchBudgetLinesByPattern(searchPattern, budgetIds),
    ]);

    const allResults = [
      ...transactions.map((t) => this.mapTransactionToResult(t)),
      ...budgetLines.map((bl) => this.mapBudgetLineToResult(bl)),
    ].sort((a, b) => b.year - a.year || b.month - a.month);

    this.logger.info(
      {
        userId: user.id,
        query,
        resultCount: allResults.length,
        operation: 'transaction.search',
      },
      'Transactions searched',
    );

    return allResults.slice(0, 50);
  }

  private buildSearchPattern(query: string): string {
    const escaped = query.replace(/[*.()[\]\\]/g, '\\$&');
    return `*${escaped}*`;
  }

  private mapTransactionToResult(
    t: TransactionSearchTransactionRow,
  ): TransactionSearchResult {
    return {
      id: t.id,
      itemType: 'transaction' as const,
      name: t.name,
      amount: t.amount,
      kind: t.kind as TransactionKind,
      recurrence: null,
      transactionDate: t.transactionDate,
      category: t.category,
      budgetId: t.budgetId,
      budgetName: t.budget?.description ?? '',
      year: t.budget?.year ?? new Date().getFullYear(),
      month: t.budget?.month ?? 1,
      monthLabel: MONTHS[(t.budget?.month ?? 1) - 1] ?? '',
    };
  }

  private mapBudgetLineToResult(
    bl: TransactionSearchBudgetLineRow,
  ): TransactionSearchResult {
    return {
      id: bl.id,
      itemType: 'budget_line' as const,
      name: bl.name,
      amount: bl.amount,
      kind: bl.kind as TransactionKind,
      recurrence: bl.recurrence,
      transactionDate: null,
      category: null,
      budgetId: bl.budgetId,
      budgetName: bl.budget?.description ?? '',
      year: bl.budget?.year ?? new Date().getFullYear(),
      month: bl.budget?.month ?? 1,
      monthLabel: MONTHS[(bl.budget?.month ?? 1) - 1] ?? '',
    };
  }
}
