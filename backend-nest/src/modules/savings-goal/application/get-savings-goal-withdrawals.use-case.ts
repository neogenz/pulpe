import { Inject, Injectable } from '@nestjs/common';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoalPlannedWithdrawal,
  SavingsGoalPlanOnlyWithdrawal,
  SavingsGoalWithdrawal,
} from 'pulpe-shared';

export interface SavingsGoalWithdrawalsReadModel {
  withdrawals: SavingsGoalWithdrawal[];
  planned: SavingsGoalPlannedWithdrawal[];
  planOnly: SavingsGoalPlanOnlyWithdrawal[];
}

/**
 * Le suivi des retraits d'un objectif (PUL-329) : Prévisions, progression de
 * leur réalisation et historique des Réels du plus récent au plus ancien.
 *
 * `findById` d'abord : sous RLS, un objectif inexistant et un objectif
 * étranger sont indiscernables, et tous deux méritent un 404 plutôt qu'une
 * liste vide — laquelle laisserait croire qu'un objectif bien réel n'a jamais
 * servi.
 */
@Injectable()
export class GetSavingsGoalWithdrawalsUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
  ) {}

  async execute(goalId: string): Promise<SavingsGoalWithdrawalsReadModel> {
    const goal = await this.repo.findById(goalId);
    const [withdrawals, plannedRecords, planOnlyRecords] = await Promise.all([
      this.repo.findWithdrawals(goalId),
      this.repo.findPlannedWithdrawalRecords(goalId),
      this.repo.findPlanWithdrawals(goalId),
    ]);

    const realizedByLine = new Map<string, number>();
    for (const withdrawal of withdrawals) {
      if (!withdrawal.budgetLineId) continue;
      realizedByLine.set(
        withdrawal.budgetLineId,
        (realizedByLine.get(withdrawal.budgetLineId) ?? 0) + withdrawal.amount,
      );
    }

    const planned = plannedRecords
      .map((record) => this.toPlannedWithdrawal(record, realizedByLine))
      .sort((a, b) => a.year - b.year || a.month - b.month);

    const planOnly = planOnlyRecords
      .map((record) => ({
        planWithdrawalId: record.id,
        name: goal.name,
        month: record.month,
        year: record.year,
        plannedAmount: record.amount,
        origin: 'plan_only' as const,
      }))
      .sort((a, b) => a.year - b.year || a.month - b.month);

    return { withdrawals, planned, planOnly };
  }

  private toPlannedWithdrawal(
    record: Awaited<
      ReturnType<SavingsGoalRepositoryPort['findPlannedWithdrawalRecords']>
    >[number],
    realizedByLine: ReadonlyMap<string, number>,
  ): SavingsGoalPlannedWithdrawal {
    const realizedAmount = realizedByLine.get(record.budgetLineId) ?? 0;
    const remainingAmount = Math.max(0, record.amount - realizedAmount);
    return {
      budgetLineId: record.budgetLineId,
      budgetId: record.budgetId,
      name: record.name,
      month: record.month,
      year: record.year,
      plannedAmount: record.amount,
      realizedAmount,
      remainingAmount,
      status:
        realizedAmount === 0
          ? 'planned'
          : remainingAmount > 0
            ? 'partially_realized'
            : 'realized',
    };
  }
}
