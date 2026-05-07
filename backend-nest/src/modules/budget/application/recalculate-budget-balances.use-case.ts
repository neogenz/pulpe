import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import { BudgetFormulas, type TransactionKind } from 'pulpe-shared';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import type { BudgetRecalculationPort } from '../domain/ports/budget-recalculation.port';

@Injectable()
export class RecalculateBudgetBalancesUseCase implements BudgetRecalculationPort {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    @InjectInfoLogger(RecalculateBudgetBalancesUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async recalculate(budgetId: string, clientKey: Buffer): Promise<void> {
    const endingBalance = await this.calculateEndingBalance(
      budgetId,
      clientKey,
    );
    await this.persistEndingBalance(budgetId, endingBalance, clientKey);
  }

  async calculateEndingBalance(
    budgetId: string,
    clientKey: Buffer,
  ): Promise<number> {
    const { budgetLines, transactions } = await this.repo.fetchBudgetData(
      budgetId,
      {
        budgetLineFields: 'id, kind, amount',
        transactionFields: 'id, kind, amount, budget_line_id',
      },
    );

    const decryptedBudgetLines = await this.decryptAmounts(
      budgetLines as { amount: string | null }[],
      budgetId,
      clientKey,
    );
    const decryptedTransactions = await this.decryptAmounts(
      transactions as { amount: string | null }[],
      budgetId,
      clientKey,
    );

    const mappedTransactions = decryptedTransactions.map((tx, i) => ({
      ...transactions[i],
      ...tx,
      budgetLineId:
        (transactions[i] as { budget_line_id?: string | null })
          .budget_line_id ?? null,
    }));

    const mappedLines = decryptedBudgetLines.map((bl, i) => ({
      ...budgetLines[i],
      ...bl,
    }));

    const metrics = BudgetFormulas.calculateAllMetrics(
      mappedLines as { id: string; kind: TransactionKind; amount: number }[],
      mappedTransactions as {
        kind: TransactionKind;
        amount: number;
        budgetLineId: string | null;
      }[],
    );
    return metrics.endingBalance;
  }

  async getRollover(
    budgetId: string,
    payDayOfMonth: number,
    clientKey: Buffer,
  ): Promise<{ rollover: number; previousBudgetId: string | null }> {
    const userId = await this.repo.fetchBudgetUserId(budgetId);
    const allBudgets = await this.repo.fetchAllBudgetsForRollover(userId);

    if (!allBudgets.length) {
      return { rollover: 0, previousBudgetId: null };
    }

    const hasEncryptedData = allBudgets.some((b) => b.ending_balance);
    const dek = hasEncryptedData
      ? await this.encryption.getUserDEK(userId, clientKey)
      : null;

    const budgetsForFormula = allBudgets.map((b) => ({
      id: b.id,
      month: b.month,
      year: b.year,
      endingBalance:
        b.ending_balance && dek
          ? this.encryption.tryDecryptAmount(b.ending_balance, dek, 0)
          : 0,
    }));

    const result = BudgetFormulas.calculateRollover(
      budgetsForFormula,
      budgetId,
      payDayOfMonth,
    );

    return {
      rollover: result.rollover,
      previousBudgetId: result.previousBudgetId,
    };
  }

  private async persistEndingBalance(
    budgetId: string,
    endingBalance: number,
    clientKey: Buffer,
  ): Promise<void> {
    const userId = await this.repo.fetchBudgetUserId(budgetId);
    const dek = await this.encryption.ensureUserDEK(userId, clientKey);
    const encryptedBalance = this.encryption.encryptAmount(endingBalance, dek);

    await this.repo.persistEndingBalance(budgetId, encryptedBalance);

    this.logger.info(
      { budgetId, operation: 'balance.recalculated' },
      'Balance de fin de mois recalculée et persistée',
    );
  }

  private async decryptAmounts<T extends object>(
    rows: (T & { amount: string | null })[],
    budgetId: string,
    clientKey: Buffer,
  ): Promise<(T & { amount: number })[]> {
    const hasEncrypted = rows.some((r) => r.amount);
    if (!hasEncrypted) return rows.map((row) => ({ ...row, amount: 0 }));

    const userId = await this.repo.fetchBudgetUserId(budgetId);
    const dek = await this.encryption.getUserDEK(userId, clientKey);

    return rows.map((row) => ({
      ...row,
      amount: row.amount
        ? this.encryption.tryDecryptAmount(row.amount, dek, 0)
        : 0,
    }));
  }
}
