import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type BudgetLineSpreadCreate } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  BUDGET_PROVISIONING_PORT,
  type BudgetProvisioningPort,
  type EnsureBudgetsResult,
  type SpreadPeriod,
} from '@modules/budget/domain/ports/budget-provisioning.port';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '@modules/budget-template/domain/ports/budget-template-repository.port';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import type {
  BudgetLine,
  BudgetLineCreateInput,
} from '../domain/budget-line.entity';

export interface CreateSpreadResult {
  spreadGroupId: string;
  lines: BudgetLine[];
  createdBudgets: EnsureBudgetsResult['createdBudgets'];
  skippedMonths: EnsureBudgetsResult['skippedMonths'];
}

/**
 * Fans a smoothed expense out into N independent `one_off` budget lines, one per
 * month, sharing a single server-generated `spread_group_id` (PUL-17 Lot A,
 * interpretation B). The per-month amounts arrive already computed from the
 * client calculator — this use case is mode-agnostic.
 *
 * Atomicity boundary: budget auto-creation runs first in its own short
 * transactions (idempotent, kept even on later failure); the line fan-out is a
 * single set-based RPC (all-or-nothing). Touched budgets are recalculated, then
 * the user cache is invalidated ONCE (a spread crosses N months).
 */
@Injectable()
export class CreateBudgetLineSpreadUseCase {
  // eslint-disable-next-line max-params
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @Inject(BUDGET_PROVISIONING_PORT)
    private readonly provisioning: BudgetProvisioningPort,
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly templateRepo: BudgetTemplateRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(CreateBudgetLineSpreadUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: BudgetLineSpreadCreate,
    user: AuthenticatedUser,
  ): Promise<CreateSpreadResult> {
    const spreadGroupId = randomUUID();
    const periods = this.dedupePeriods(dto.tranches);
    const templateId = await this.templateRepo.findDefaultTemplateId(user.id);

    try {
      const ensured = await this.provisioning.ensureBudgetsForPeriods(
        periods,
        templateId,
        user.id,
      );

      const inputs = this.buildInputs(dto, ensured.budgetIdByPeriod);
      const lines = inputs.length
        ? await this.repo.createSpread(spreadGroupId, inputs)
        : [];

      const touchedBudgetIds = [
        ...new Set(inputs.map((input) => input.budgetId)),
      ];
      await Promise.all(
        touchedBudgetIds.map((id) => this.budgetRecalculation.recalculate(id)),
      );
      await this.cacheService.invalidateForUser(user.id);

      this.logger.info(
        {
          userId: user.id,
          spreadGroupId,
          linesCreated: lines.length,
          budgetsCreated: ensured.createdBudgets.length,
          skippedMonths: ensured.skippedMonths.length,
          operation: 'budgetLine.spread',
        },
        'Spread budget lines created',
      );

      return {
        spreadGroupId,
        lines,
        createdBudgets: ensured.createdBudgets,
        skippedMonths: ensured.skippedMonths,
      };
    } catch (error) {
      await this.cacheService.invalidateForUser(user.id);
      if (error instanceof BusinessException) throw error;
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED,
        undefined,
        { operation: 'budgetLine.spread', userId: user.id },
        { cause: error },
      );
    }
  }

  private buildInputs(
    dto: BudgetLineSpreadCreate,
    budgetIdByPeriod: Map<string, string>,
  ): BudgetLineCreateInput[] {
    const inputs: BudgetLineCreateInput[] = [];
    for (const tranche of dto.tranches) {
      const budgetId = budgetIdByPeriod.get(`${tranche.month}/${tranche.year}`);
      if (!budgetId) continue;
      inputs.push({
        budgetId,
        name: dto.name,
        amount: tranche.amount,
        kind: dto.kind,
        recurrence: 'one_off',
        savingsGoalId: null,
        originalAmount: tranche.originalAmount ?? null,
        originalCurrency: dto.originalCurrency ?? null,
        targetCurrency: dto.targetCurrency ?? null,
        exchangeRate: dto.exchangeRate ?? null,
      });
    }
    return inputs;
  }

  private dedupePeriods(
    tranches: BudgetLineSpreadCreate['tranches'],
  ): SpreadPeriod[] {
    const seen = new Set<string>();
    const periods: SpreadPeriod[] = [];
    for (const tranche of tranches) {
      const key = `${tranche.month}/${tranche.year}`;
      if (seen.has(key)) continue;
      seen.add(key);
      periods.push({ month: tranche.month, year: tranche.year });
    }
    return periods;
  }
}
