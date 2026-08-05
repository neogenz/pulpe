import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { CacheService } from '@modules/cache/cache.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import type { BudgetLine } from '../domain/budget-line.entity';

@Injectable()
export class ToggleBudgetLineCheckUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(ToggleBudgetLineCheckUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<BudgetLine> {
    await this.repo.validateAccess(id, user.id);
    await this.assertNotAFakeRealization(id);
    const entity = await this.repo.toggleCheckRpc(id);

    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        budgetLineId: id,
        userId: user.id,
        operation: 'budgetLine.toggleCheck',
      },
      'Budget line check toggled',
    );

    return entity;
  }

  /**
   * Pointer une prévision, c'est déclarer « c'est arrivé ». Sur un retrait
   * planifié, ce serait déclarer que l'argent est sorti de l'objectif sans
   * qu'aucune écriture ne l'en ait retiré : le solde confirmé resterait entier
   * et `calculateRealizedIncome` compterait la ligne alors qu'aucun revenu réel
   * n'existe. La sortie se prouve en créant la transaction, pas en cochant.
   *
   * Seul le passage à pointé est fermé. Dépointer une donnée historique
   * incohérente reste possible — c'est le geste qui la répare.
   */
  private async assertNotAFakeRealization(id: string): Promise<void> {
    const line = await this.repo.findById(id);
    if (!line.sourceSavingsGoalId || line.checkedAt) return;

    throw new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_TRANSACTION_INVALID,
      {
        reason:
          'a planned withdrawal is realized by creating its real income, not by checking it',
      },
    );
  }
}
