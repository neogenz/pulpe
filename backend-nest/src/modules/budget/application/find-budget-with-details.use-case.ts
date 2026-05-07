import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type BudgetDetailsResponse,
  PAY_DAY_MIN,
  PAY_DAY_MAX,
} from 'pulpe-shared';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import { CacheService } from '@modules/cache/cache.service';
import * as transactionMappers from '@modules/transaction/transaction.mappers';
import * as budgetLineMappers from '@modules/budget-line/budget-line.mappers';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import { BudgetMapper } from '../infrastructure/mappers/budget.mapper';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';

@Injectable()
export class FindBudgetWithDetailsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly cacheService: CacheService,
    private readonly mapper: BudgetMapper,
    private readonly recalculateUseCase: RecalculateBudgetBalancesUseCase,
    @InjectInfoLogger(FindBudgetWithDetailsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDetailsResponse> {
    const clientKeyHash = user.clientKey.toString('hex').slice(0, 16);
    const cacheKey = `budgets:detail:${clientKeyHash}:${budgetId}`;
    return this.cacheService.getOrSet(user.id, cacheKey, 30_000, () =>
      this.fetchBudgetWithDetails(budgetId, user, supabase),
    );
  }

  private async fetchBudgetWithDetails(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDetailsResponse> {
    const payDayOfMonth = await this.getPayDayOfMonth(supabase);
    const budgetData = await this.repo.validateBudgetExists(budgetId, supabase);

    const results = await this.repo.fetchBudgetData(budgetId, supabase, {
      budgetLineFields: '*',
      transactionFields: '*',
      orderTransactions: true,
    });

    results.budget = budgetData;

    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);

    const decryptedBudgetLines = results.budgetLines.map((line) =>
      this.encryption.decryptRowAmountFields(line, dek),
    );
    const decryptedTransactions = results.transactions.map((tx) =>
      this.encryption.decryptRowAmountFields(tx, dek),
    );

    const rolloverData = await this.recalculateUseCase.getRollover(
      budgetId,
      payDayOfMonth,
      supabase,
      user.clientKey,
    );

    const responseData = {
      budget: {
        ...this.mapper.toApi({
          ...budgetData,
          ending_balance: budgetData.ending_balance
            ? this.encryption.tryDecryptAmount(
                budgetData.ending_balance,
                dek,
                0,
              )
            : null,
        }),
        rollover: rolloverData.rollover,
        previousBudgetId: rolloverData.previousBudgetId,
      },
      transactions: transactionMappers.toApiList(decryptedTransactions),
      budgetLines: budgetLineMappers.toApiList(decryptedBudgetLines),
    };

    this.logger.info(
      {
        budgetId,
        transactionCount: responseData.transactions.length,
        budgetLineCount: responseData.budgetLines.length,
        operation: 'budget.details.fetched',
      },
      'Budget details fetched successfully',
    );

    return { success: true, data: responseData } as BudgetDetailsResponse;
  }

  private async getPayDayOfMonth(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    const { data } = await supabase.auth.getUser();
    const raw = data?.user?.user_metadata?.payDayOfMonth;

    if (typeof raw !== 'number' || !Number.isInteger(raw)) return PAY_DAY_MIN;

    return Math.max(PAY_DAY_MIN, Math.min(PAY_DAY_MAX, raw));
  }
}
