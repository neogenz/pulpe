import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type BudgetExportResponse,
  type BudgetWithDetails,
  PAY_DAY_MIN,
  PAY_DAY_MAX,
} from 'pulpe-shared';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import * as transactionMappers from '@modules/transaction/transaction.mappers';
import * as budgetLineMappers from '@modules/budget-line/budget-line.mappers';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import { BudgetMapper } from '../infrastructure/mappers/budget.mapper';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';
import type { BudgetRow } from '../domain/budget.entity';

@Injectable()
export class ExportAllBudgetsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly mapper: BudgetMapper,
    private readonly recalculateUseCase: RecalculateBudgetBalancesUseCase,
    @InjectInfoLogger(ExportAllBudgetsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetExportResponse> {
    const startTime = Date.now();
    const payDayOfMonth = await this.getPayDayOfMonth(supabase);
    const budgets = await this.repo.fetchAllBudgetsForExport();
    const budgetsWithDetails = await Promise.all(
      budgets.map((budget) =>
        this.enrichBudgetForExport(
          budget,
          supabase,
          payDayOfMonth,
          user.clientKey,
        ),
      ),
    );

    this.logger.info(
      {
        userId: user.id,
        budgetCount: budgetsWithDetails.length,
        duration: Date.now() - startTime,
        operation: 'budget.export.success',
      },
      'All budgets exported successfully',
    );

    return {
      success: true as const,
      data: {
        exportDate: new Date().toISOString(),
        totalBudgets: budgetsWithDetails.length,
        budgets: budgetsWithDetails,
      },
    };
  }

  private async enrichBudgetForExport(
    budget: BudgetRow,
    supabase: AuthenticatedSupabaseClient,
    payDayOfMonth: number,
    clientKey: Buffer,
  ): Promise<BudgetWithDetails> {
    const { transactions, budgetLines } = await this.repo.fetchBudgetData(
      budget.id,
      {
        budgetLineFields: '*',
        transactionFields: '*',
        orderTransactions: true,
      },
    );

    const rolloverData = await this.recalculateUseCase.getRollover(
      budget.id,
      payDayOfMonth,
      supabase,
      clientKey,
    );

    const remaining = await this.calculateRemainingForBudget(
      budget,
      supabase,
      payDayOfMonth,
      clientKey,
    );

    const dek = await this.encryption.getUserDEK(budget.user_id!, clientKey);

    const decryptedBudgetLines = budgetLines.map((line) =>
      this.encryption.decryptRowAmountFields(line, dek),
    );
    const decryptedTransactions = transactions.map((tx) =>
      this.encryption.decryptRowAmountFields(tx, dek),
    );

    return {
      ...this.mapper.toApi({
        ...budget,
        ending_balance: budget.ending_balance
          ? this.encryption.tryDecryptAmount(budget.ending_balance, dek, 0)
          : null,
      }),
      rollover: rolloverData.rollover,
      previousBudgetId: rolloverData.previousBudgetId,
      remaining,
      transactions: transactionMappers.toApiList(decryptedTransactions),
      budgetLines: budgetLineMappers.toApiList(decryptedBudgetLines),
    };
  }

  private async calculateRemainingForBudget(
    budget: BudgetRow,
    supabase: AuthenticatedSupabaseClient,
    payDayOfMonth: number,
    clientKey: Buffer,
  ): Promise<number> {
    const currentBalance = await this.recalculateUseCase.calculateEndingBalance(
      budget.id,
      supabase,
      clientKey,
    );
    const rolloverData = await this.recalculateUseCase.getRollover(
      budget.id,
      payDayOfMonth,
      supabase,
      clientKey,
    );
    return currentBalance + rolloverData.rollover;
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
