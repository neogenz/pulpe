import { Inject, Injectable } from '@nestjs/common';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  getBudgetPeriodForDate,
  parseIsoDateLocal,
  periodIndex,
  type SavingsGoalCreate,
} from 'pulpe-shared';
import {
  BUDGET_LINE_SPREAD_PORT,
  type BudgetLineSpreadPort,
  type SpreadTranche,
} from '@modules/budget-line/domain/ports/budget-line-spread.port';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoal } from '../domain/savings-goal.entity';

@Injectable()
export class CreateSavingsGoalUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @Inject(BUDGET_LINE_SPREAD_PORT)
    private readonly spread: BudgetLineSpreadPort,
    @InjectInfoLogger(CreateSavingsGoalUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: SavingsGoalCreate,
    user: AuthenticatedUser,
  ): Promise<SavingsGoal> {
    const entity = await this.repo.insert({
      name: dto.name,
      targetAmount: dto.targetAmount,
      targetDate: dto.targetDate,
      status: dto.status ?? 'ACTIVE',
      originalTargetAmount: dto.originalTargetAmount ?? null,
      originalCurrency: dto.originalCurrency ?? null,
      targetCurrency: dto.targetCurrency ?? null,
      exchangeRate: dto.exchangeRate ?? null,
      initialAmount: dto.initialAmount ?? null,
    });

    let baselineCreated = false;
    if (dto.monthlyContribution != null) {
      baselineCreated = await this.materializeContributions(
        entity,
        dto.monthlyContribution,
        user,
      );
    }

    this.logger.info(
      {
        savingsGoalId: entity.id,
        userId: user.id,
        operation: 'savingsGoal.create',
        autoDecompose: dto.monthlyContribution != null,
        baselineCreated,
      },
      'Savings goal created',
    );

    return entity;
  }

  /**
   * PUL-316 — un objectif daté est un engagement BORNÉ, donc il se matérialise
   * en prévisions `one_off` liées, une par mois budgété du mois courant à
   * l'échéance incluse. Le Mois Type reste intact : y poser une récurrence
   * signifierait « tous les mois, indéfiniment », ce qui contredit l'échéance et
   * fausse le solde net du modèle au-delà d'elle (PUL-311, PUL-312).
   *
   * Créer un objectif ne crée AUCUN budget : seuls les mois déjà budgétés
   * reçoivent leur prévision. Les mois plus lointains restent des trous du plan,
   * que « Ajuster mon plan » comble à la demande.
   *
   * Best-effort : l'objectif est déjà committé, donc un échec de matérialisation
   * ne le fait jamais échouer. Si les prévisions ont bien été committées mais que
   * le recalcul échoue, un code dédié prévient le client de rafraîchir sans
   * recréer l'objectif.
   */
  private async materializeContributions(
    goal: SavingsGoal,
    monthlyContribution: number,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    try {
      const tranches = await this.budgetedTranches(
        goal,
        monthlyContribution,
        user.payDayOfMonth ?? null,
      );
      if (tranches.length === 0) {
        this.logger.warn(
          {
            operation: 'savingsGoal.autoDecompose',
            userId: user.id,
            savingsGoalId: goal.id,
          },
          'No budgeted month in the goal horizon — goal created without its forecasts',
        );
        return false;
      }

      const { lines, skippedMonths } = await this.spread.fanOut(
        {
          name: goal.name,
          kind: 'saving',
          savingsGoalId: goal.id,
          tranches,
          // One goal, one spread group: the goal id IS the idempotency key.
          spreadGroupId: goal.id,
        },
        user,
      );
      // Every tranche targets an already-budgeted period, so a skipped month
      // means one vanished between the two reads. Rare, but it must not pass as
      // a fully materialized plan.
      if (skippedMonths.length > 0) {
        this.logger.warn(
          {
            operation: 'savingsGoal.autoDecompose',
            userId: user.id,
            savingsGoalId: goal.id,
            skippedMonthCount: skippedMonths.length,
          },
          'Some budgeted months received no forecast',
        );
      }
      return lines.length > 0;
    } catch (err) {
      this.rethrowCommittedBaselineFailure(err, goal.id, user.id);
      this.logger.warn(
        {
          operation: 'savingsGoal.autoDecompose',
          userId: user.id,
          savingsGoalId: goal.id,
          err,
        },
        'Linked forecast generation failed — goal created without it',
      );
      return false;
    }
  }

  /**
   * Mois courant et échéance INCLUS (docs/SAVINGS.md §3.5 :
   * `monthsRemaining = indexÉchéance − indexCourant + 1`), et la comparaison est
   * payDay-aware — un objectif échéant le 12 octobre avec une paie au 27
   * appartient au cycle d'octobre, pas à celui de septembre.
   */
  private async budgetedTranches(
    goal: SavingsGoal,
    monthlyContribution: number,
    payDayOfMonth: number | null,
  ): Promise<SpreadTranche[]> {
    const currentIndex = periodIndex(
      getBudgetPeriodForDate(new Date(), payDayOfMonth),
    );
    const targetIndex = periodIndex(
      getBudgetPeriodForDate(parseIsoDateLocal(goal.targetDate), payDayOfMonth),
    );

    const budgetedPeriods = await this.repo.findMaterializedPeriods();
    return budgetedPeriods
      .filter((period) => {
        const index = periodIndex(period);
        return index >= currentIndex && index <= targetIndex;
      })
      .sort((a, b) => periodIndex(a) - periodIndex(b))
      .map((period) => ({
        year: period.year,
        month: period.month,
        amount: monthlyContribution,
      }));
  }

  private rethrowCommittedBaselineFailure(
    error: unknown,
    savingsGoalId: string,
    userId: string,
  ): void {
    if (
      !(error instanceof BusinessException) ||
      error.loggingContext.partialFailure !== true
    ) {
      return;
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_BASELINE_RECALCULATION_FAILED,
      undefined,
      {
        operation: 'savingsGoal.autoDecompose.recalcAfterCommit',
        severity: 'critical',
        partialFailure: true,
        affectedBudgetIds: error.loggingContext.affectedBudgetIds,
        userId,
        savingsGoalId,
      },
      { cause: error },
    );
  }
}
