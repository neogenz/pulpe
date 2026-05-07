import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type TransactionSearchResponse,
  type TransactionSearchResult,
  type TransactionKind,
} from 'pulpe-shared';
import { EncryptionService } from '@modules/encryption/encryption.service';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';

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
    private readonly encryptionService: EncryptionService,
    @InjectInfoLogger(SearchTransactionsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    query: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
    years?: number[],
  ): Promise<TransactionSearchResponse> {
    const searchPattern = this.buildSearchPattern(query);

    const budgetIds = years?.length
      ? await this.repo.fetchBudgetIdsByYears(user.id, years, supabase)
      : null;

    if (years?.length && budgetIds?.length === 0) {
      return { success: true, data: [] };
    }

    const [transactionsDb, budgetLinesDb] = await Promise.all([
      this.repo.fetchTransactionsByPattern(searchPattern, budgetIds, supabase),
      this.repo.fetchBudgetLinesByPattern(searchPattern, budgetIds, supabase),
    ]);

    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );

    const decryptedTransactions = transactionsDb.map((t) => ({
      ...t,
      amount: t.amount
        ? this.encryptionService.tryDecryptAmount(t.amount, dek, 0)
        : 0,
    }));

    const decryptedBudgetLines = budgetLinesDb.map((bl) => ({
      ...bl,
      amount: bl.amount
        ? this.encryptionService.tryDecryptAmount(bl.amount, dek, 0)
        : 0,
    }));

    const allResults = [
      ...decryptedTransactions.map((t) => this.mapTransactionToResult(t)),
      ...decryptedBudgetLines.map((bl) => this.mapBudgetLineToResult(bl)),
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

    return { success: true as const, data: allResults.slice(0, 50) };
  }

  private buildSearchPattern(query: string): string {
    const escaped = query.replace(/[*.()[\]\\]/g, '\\$&');
    return `*${escaped}*`;
  }

  private mapTransactionToResult(t: {
    id: string;
    name: string;
    amount: number;
    kind: string;
    transaction_date: string;
    category: string | null;
    budget_id: string;
    budget: unknown;
  }): TransactionSearchResult {
    const budget = t.budget as {
      description: string;
      month: number;
      year: number;
    } | null;

    return {
      id: t.id,
      itemType: 'transaction' as const,
      name: t.name,
      amount: t.amount,
      kind: t.kind as TransactionKind,
      recurrence: null,
      transactionDate: t.transaction_date,
      category: t.category,
      budgetId: t.budget_id,
      budgetName: budget?.description ?? '',
      year: budget?.year ?? new Date().getFullYear(),
      month: budget?.month ?? 1,
      monthLabel: MONTHS[(budget?.month ?? 1) - 1] ?? '',
    };
  }

  private mapBudgetLineToResult(bl: {
    id: string;
    name: string;
    amount: number;
    kind: string;
    recurrence: 'fixed' | 'one_off';
    budget_id: string;
    budget: unknown;
  }): TransactionSearchResult {
    const budget = bl.budget as {
      description: string;
      month: number;
      year: number;
    } | null;

    return {
      id: bl.id,
      itemType: 'budget_line' as const,
      name: bl.name,
      amount: bl.amount,
      kind: bl.kind as TransactionKind,
      recurrence: bl.recurrence,
      transactionDate: null,
      category: null,
      budgetId: bl.budget_id,
      budgetName: budget?.description ?? '',
      year: budget?.year ?? new Date().getFullYear(),
      month: budget?.month ?? 1,
      monthLabel: MONTHS[(budget?.month ?? 1) - 1] ?? '',
    };
  }
}
