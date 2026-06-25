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
  BudgetLineSpreadPort,
  SpreadFanOutInput,
  SpreadFanOutResult,
} from '../domain/ports/budget-line-spread.port';
import type {
  BudgetLine,
  BudgetLineCreateInput,
  SpreadDeleteSource,
} from '../domain/budget-line.entity';
import { buildSpreadTranches } from '../domain/spread-additive.formulas';

export interface CreateSpreadResult {
  spreadGroupId: string;
  lines: BudgetLine[];
  createdBudgets: EnsureBudgetsResult['createdBudgets'];
  skippedMonths: EnsureBudgetsResult['skippedMonths'];
}

/**
 * Fans a smoothed expense out into N independent `one_off` budget lines, one per
 * month, sharing a single server-generated `spread_group_id` (PUL-17 Lot A,
 * interpretation B). The additive create flow now BUILDS its tranches server-side
 * from the per-month intent (`{perMonthAmount, months}`, PUL-287) via
 * `buildSpreadTranches`; the PORT (`fanOut`/`fanOutStrict`) stays mode-agnostic —
 * the spread-from flows feed it pre-split tranches instead.
 *
 * Two entry points share the SAME fan-out core:
 * - `execute()` — the additive create flow (POST /budget-lines/spread): tolerates
 *   months without a default template (they land in `skippedMonths`).
 * - `fanOut()` — the reusable port (`BUDGET_LINE_SPREAD_PORT`) driving the
 *   total-preserving spread-from flows (a prévision or a free réel). The CALLER
 *   decides whether a skipped month is fatal (the Σ=T contract forbids dropping
 *   one silently).
 *
 * Atomicity boundary: budget auto-creation runs first in its own short
 * transactions (idempotent, kept even on later failure); the line fan-out is a
 * single set-based RPC (all-or-nothing). Touched budgets are recalculated, then
 * the user cache is invalidated ONCE (a spread crosses N months).
 */
@Injectable()
export class CreateBudgetLineSpreadUseCase implements BudgetLineSpreadPort {
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
    return this.fanOut(
      {
        name: dto.name,
        kind: dto.kind,
        tranches: buildSpreadTranches(
          dto.perMonthAmount,
          dto.months,
          dto.perMonthOriginalAmount ?? null,
        ),
        originalCurrency: dto.originalCurrency ?? null,
        targetCurrency: dto.targetCurrency ?? null,
        exchangeRate: dto.exchangeRate ?? null,
      },
      user,
    );
  }

  /**
   * Terminal tolerant fan-out: provisions, inserts, recalculates, then
   * invalidates the user cache (this IS the last mutation of the additive flow).
   * No source to delete — the additive create flow only inserts.
   */
  async fanOut(
    input: SpreadFanOutInput,
    user: AuthenticatedUser,
  ): Promise<SpreadFanOutResult> {
    try {
      const result = await this.provisionAndInsert(input, user, false);
      await this.cacheService.invalidateForUser(user.id);
      return result;
    } catch (error) {
      await this.cacheService.invalidateForUser(user.id);
      throw this.toFanOutError(error, user);
    }
  }

  /**
   * Non-terminal strict fan-out for the spread-from flows: fails entirely if any
   * month is unprovisionable, and does NOT invalidate the cache — the caller
   * performs further mutations and owns the single terminal `invalidateForUser`.
   *
   * `source` is deleted ATOMICALLY inside the same RPC as the insert (PUL-17 v1.1
   * Defect 2): a fan-out failure leaves the source intact with nothing created
   * (no double-count, no money loss, no duplicate-on-retry).
   */
  async fanOutStrict(
    input: SpreadFanOutInput,
    user: AuthenticatedUser,
    source: SpreadDeleteSource,
  ): Promise<SpreadFanOutResult> {
    try {
      return await this.provisionAndInsert(input, user, true, source);
    } catch (error) {
      throw this.toFanOutError(error, user);
    }
  }

  private async provisionAndInsert(
    input: SpreadFanOutInput,
    user: AuthenticatedUser,
    requireAllProvisioned: boolean,
    source?: SpreadDeleteSource,
  ): Promise<SpreadFanOutResult> {
    const spreadGroupId = randomUUID();
    const periods = this.dedupePeriods(input.tranches);
    const templateId = await this.templateRepo.findDefaultTemplateId(user.id);

    const ensured = await this.provisioning.ensureBudgetsForPeriods(
      periods,
      templateId,
      user.id,
    );

    if (requireAllProvisioned && ensured.skippedMonths.length > 0) {
      const [skipped] = ensured.skippedMonths;
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_SPREAD_MONTH_UNPROVISIONABLE,
        { month: skipped.month, year: skipped.year },
        { operation: 'budgetLine.spreadFrom', userId: user.id },
      );
    }

    const inputs = this.buildInputs(input, ensured.budgetIdByPeriod);
    const lines = inputs.length
      ? await this.repo.createSpread(spreadGroupId, inputs, source)
      : [];

    const touchedBudgetIds = [
      ...new Set(inputs.map((createInput) => createInput.budgetId)),
    ];
    await this.recalculateAfterCommit(touchedBudgetIds, spreadGroupId, user.id);

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
  }

  private toFanOutError(
    error: unknown,
    user: AuthenticatedUser,
  ): BusinessException {
    if (error instanceof BusinessException) return error;
    return new BusinessException(
      ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED,
      undefined,
      { operation: 'budgetLine.spread', userId: user.id },
      { cause: error },
    );
  }

  private async recalculateAfterCommit(
    budgetIds: string[],
    spreadGroupId: string,
    userId: string,
  ): Promise<void> {
    try {
      await Promise.all(
        budgetIds.map((id) => this.budgetRecalculation.recalculate(id)),
      );
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_SPREAD_RECALCULATION_FAILED,
        undefined,
        {
          operation: 'budgetLine.spread.recalcAfterCommit',
          severity: 'critical',
          partialFailure: true,
          affectedBudgetIds: budgetIds,
          spreadGroupId,
          userId,
        },
        { cause },
      );
    }
  }

  private buildInputs(
    input: SpreadFanOutInput,
    budgetIdByPeriod: Map<string, string>,
  ): BudgetLineCreateInput[] {
    const inputs: BudgetLineCreateInput[] = [];
    for (const tranche of input.tranches) {
      const budgetId = budgetIdByPeriod.get(`${tranche.month}/${tranche.year}`);
      if (!budgetId) continue;
      inputs.push({
        budgetId,
        name: input.name,
        amount: tranche.amount,
        kind: input.kind,
        recurrence: 'one_off',
        savingsGoalId: null,
        originalAmount: tranche.originalAmount ?? null,
        originalCurrency: input.originalCurrency ?? null,
        targetCurrency: input.targetCurrency ?? null,
        exchangeRate: input.exchangeRate ?? null,
      });
    }
    return inputs;
  }

  private dedupePeriods(
    tranches: SpreadFanOutInput['tranches'],
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
