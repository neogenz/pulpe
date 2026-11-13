import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import type {
  BudgetProvisioningPort,
  EnsureBudgetsResult,
  SpreadPeriod,
} from '../domain/ports/budget-provisioning.port';
import type { Budget } from '../domain/budget.entity';

@Injectable()
export class EnsureBudgetsForPeriodsUseCase implements BudgetProvisioningPort {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @InjectInfoLogger(EnsureBudgetsForPeriodsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async ensureBudgetsForPeriods(
    periods: SpreadPeriod[],
    templateId: string | null,
    userId: string,
  ): Promise<EnsureBudgetsResult> {
    const budgetIdByPeriod = new Map<string, string>();
    const missingPeriods = new Map<string, SpreadPeriod>();
    const skippedMonths: SpreadPeriod[] = [];

    if (periods.length === 0) {
      return { budgetIdByPeriod, createdBudgets: [], skippedMonths };
    }

    const existingPeriods = await this.repo.getExistingPeriods(userId, periods);

    for (const period of periods) {
      const key = `${period.month}/${period.year}`;
      const existingId = existingPeriods.get(key);
      if (existingId) {
        budgetIdByPeriod.set(key, existingId);
      } else if (templateId) {
        missingPeriods.set(key, period);
      } else {
        skippedMonths.push(period);
      }
    }

    const createdBudgets = await this.createFromTemplate(
      [...missingPeriods.values()],
      templateId,
      userId,
    );
    for (const budget of createdBudgets) {
      budgetIdByPeriod.set(`${budget.month}/${budget.year}`, budget.id);
    }

    this.logger.info(
      {
        userId,
        requested: periods.length,
        created: createdBudgets.length,
        skipped: skippedMonths.length,
        operation: 'budget.ensureForPeriods',
      },
      'Ensured budgets for spread periods',
    );

    return { budgetIdByPeriod, createdBudgets, skippedMonths };
  }

  private async createFromTemplate(
    periods: SpreadPeriod[],
    templateId: string | null,
    userId: string,
  ): Promise<Budget[]> {
    if (!templateId || periods.length === 0) return [];
    return this.repo.createBudgetsFromTemplate({
      userId,
      templateId,
      periods: periods.map((period) => ({
        ...period,
        description: `Budget ${period.month}/${period.year}`,
      })),
    });
  }
}
