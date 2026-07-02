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
import { SpreadGroupAlreadyExistsError } from '../domain/spread-group-conflict.error';
import {
  buildSpreadTranches,
  buildSpreadTranchesFromTotal,
} from '../domain/spread-additive.formulas';

export interface CreateSpreadResult {
  spreadGroupId: string;
  lines: BudgetLine[];
  createdBudgets: EnsureBudgetsResult['createdBudgets'];
  skippedMonths: EnsureBudgetsResult['skippedMonths'];
}

/**
 * Fans a smoothed expense out into N independent `one_off` budget lines, one per
 * month, sharing a single `spread_group_id` (client idempotency key when present,
 * otherwise server-generated). The additive create flow BUILDS its tranches server-side
 * from the dual-mode intent (PUL-287): `perMonth` REPLICATES one amount per month
 * (`buildSpreadTranches`, tolerant), `total` DIVIDES a typed total cents-preserving
 * (`buildSpreadTranchesFromTotal`, strict). The PORT (`fanOut`/`fanOutStrict`)
 * stays mode-agnostic — the spread-from flows feed it pre-split tranches instead.
 *
 * Entry points share the SAME provision-and-insert core:
 * - `execute()` — the additive create flow (POST /budget-lines/spread): branches
 *   on `dto.mode`. `perMonth` tolerates months without a default template (they
 *   land in `skippedMonths`); `total` is strict — an unprovisionable month fails
 *   the whole op (Σ === typed total forbids dropping one).
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
    const fx = {
      originalCurrency: dto.originalCurrency ?? null,
      targetCurrency: dto.targetCurrency ?? null,
      exchangeRate: dto.exchangeRate ?? null,
    };

    // Total mode DIVIDES a typed total (Σ === total), so a month that cannot be
    // provisioned must fail the whole op — dropping one would break the sum.
    if (dto.mode === 'total') {
      return this.fanOutStrictAdditive(
        {
          name: dto.name,
          kind: dto.kind,
          tranches: buildSpreadTranchesFromTotal(
            dto.totalAmount!,
            dto.months,
            dto.totalOriginalAmount ?? null,
          ),
          spreadGroupId: dto.spreadGroupId,
          ...fx,
        },
        user,
      );
    }

    // Per-month mode REPLICATES one amount per month; a month without a default
    // template tolerantly lands in `skippedMonths`.
    return this.fanOut(
      {
        name: dto.name,
        kind: dto.kind,
        tranches: buildSpreadTranches(
          dto.perMonthAmount!,
          dto.months,
          dto.perMonthOriginalAmount ?? null,
        ),
        spreadGroupId: dto.spreadGroupId,
        ...fx,
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

  /**
   * Terminal STRICT fan-out for the additive total-mode create flow: like
   * `fanOut` it is the last mutation of the request (invalidates the cache on
   * both success and failure), but like `fanOutStrict` it fails the whole op if
   * ANY month is unprovisionable (HTTP 422) — total mode divides a typed total
   * (Σ === total), so silently dropping a month would break the sum. No source
   * to delete: the additive create flow only inserts.
   */
  private async fanOutStrictAdditive(
    input: SpreadFanOutInput,
    user: AuthenticatedUser,
  ): Promise<SpreadFanOutResult> {
    try {
      const result = await this.provisionAndInsert(input, user, true);
      await this.cacheService.invalidateForUser(user.id);
      return result;
    } catch (error) {
      await this.cacheService.invalidateForUser(user.id);
      throw this.toFanOutError(error, user);
    }
  }

  private async provisionAndInsert(
    input: SpreadFanOutInput,
    user: AuthenticatedUser,
    requireAllProvisioned: boolean,
    source?: SpreadDeleteSource,
  ): Promise<SpreadFanOutResult> {
    // A client-supplied key is the idempotency token (PUL-17); absent → server
    // generates one as before. The same value becomes the DB `spread_group_id`.
    const spreadGroupId = input.spreadGroupId ?? randomUUID();
    const periods = this.dedupePeriods(input.tranches);
    const templateId = await this.templateRepo.findDefaultTemplateId(user.id);

    const ensured = await this.provisioning.ensureBudgetsForPeriods(
      periods,
      templateId,
      user.id,
    );

    if (requireAllProvisioned && ensured.skippedMonths.length > 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_SPREAD_MONTH_UNPROVISIONABLE,
        {
          months: ensured.skippedMonths.map((m) => ({
            month: m.month,
            year: m.year,
          })),
        },
        { operation: 'budgetLine.spreadFrom', userId: user.id },
      );
    }

    const inputs = this.buildInputs(input, ensured.budgetIdByPeriod);
    try {
      const lines = inputs.length
        ? await this.repo.createSpread(spreadGroupId, inputs, source)
        : [];
      return await this.finalizeSpread(
        spreadGroupId,
        inputs,
        lines,
        ensured,
        user,
      );
    } catch (error) {
      // Idempotent retry (additive create only): the client replayed its own
      // spreadGroupId and the DB dup-group guard fired. Serve the group already
      // created instead of inserting a second one. The source-backed flows never
      // set `input.spreadGroupId` (they are retry-safe via source consumption).
      if (
        input.spreadGroupId &&
        error instanceof SpreadGroupAlreadyExistsError
      ) {
        return this.replayExistingSpread(input.spreadGroupId, ensured, user);
      }
      throw error;
    }
  }

  private async finalizeSpread(
    spreadGroupId: string,
    inputs: BudgetLineCreateInput[],
    lines: BudgetLine[],
    ensured: EnsureBudgetsResult,
    user: AuthenticatedUser,
  ): Promise<SpreadFanOutResult> {
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

  /**
   * Idempotent replay: the dup-group guard fired on a retry that reused the same
   * client key. Return the lines the FIRST attempt committed and re-run the
   * (idempotent) recalculation on their budgets — this HEALS a balance the first
   * attempt left stale by failing its recalc after the insert committed. An empty
   * fetch means the group exists but is not the caller's (RLS hid it): surface a
   * 409 rather than fabricate a success.
   */
  private async replayExistingSpread(
    spreadGroupId: string,
    ensured: EnsureBudgetsResult,
    user: AuthenticatedUser,
  ): Promise<SpreadFanOutResult> {
    const lines = await this.repo.findBudgetLinesBySpreadGroupId(spreadGroupId);
    if (lines.length === 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_ALREADY_SPREAD,
        undefined,
        {
          operation: 'budgetLine.spread.replay',
          spreadGroupId,
          userId: user.id,
        },
      );
    }

    const touchedBudgetIds = [...new Set(lines.map((line) => line.budgetId))];
    await this.recalculateAfterCommit(touchedBudgetIds, spreadGroupId, user.id);

    this.logger.info(
      {
        userId: user.id,
        spreadGroupId,
        linesReplayed: lines.length,
        operation: 'budgetLine.spread.replay',
      },
      'Spread replay served the existing group',
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
