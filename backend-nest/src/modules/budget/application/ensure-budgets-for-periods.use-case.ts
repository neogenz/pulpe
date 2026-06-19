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
    const createdBudgets: Budget[] = [];
    const skippedMonths: SpreadPeriod[] = [];

    if (periods.length === 0) {
      return { budgetIdByPeriod, createdBudgets, skippedMonths };
    }

    const existingPeriods = await this.repo.getExistingPeriods(userId, periods);

    for (const period of periods) {
      const key = `${period.month}/${period.year}`;
      if (budgetIdByPeriod.has(key)) continue;

      if (existingPeriods.has(key)) {
        const existingId = await this.repo.fetchBudgetIdByPeriod(
          period.month,
          period.year,
        );
        if (existingId) budgetIdByPeriod.set(key, existingId);
        continue;
      }

      if (!templateId) {
        skippedMonths.push(period);
        continue;
      }

      const created = await this.createFromTemplate(period, templateId, userId);
      budgetIdByPeriod.set(key, created.id);
      createdBudgets.push(created);
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
    period: SpreadPeriod,
    templateId: string,
    userId: string,
  ): Promise<Budget> {
    const result = await this.repo.createBudgetFromTemplateRpc({
      p_user_id: userId,
      p_template_id: templateId,
      p_month: period.month,
      p_year: period.year,
      p_description: `Budget ${period.month}/${period.year}`,
    });
    return this.repo.fetchBudgetById(result.budget.id, userId);
  }
}
