import { Inject, Injectable } from '@nestjs/common';
import {
  computeSavingsGoalProgress,
  WITHDRAWAL_BALANCE_TOLERANCE,
} from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoalWithdrawalPolicyPort,
  SavingsGoalWithdrawalWrite,
} from '../domain/ports/savings-goal-withdrawal-policy.port';

/** Un seul nouvel essai : au-delà, l'objectif est disputé, pas ralenti. */
const MAX_ATTEMPTS = 2;

interface Balance {
  confirmed: number;
  revision: number;
}

/**
 * La règle de solde des retraits (PUL-329) : on ne sort d'un objectif que ce
 * qu'il contient.
 *
 * Le solde est calculé en clair côté serveur — les colonnes de montant sont
 * chiffrées, PostgreSQL ne peut pas le recalculer pour se défendre seul. La
 * révision lue avec lui voyage donc jusqu'à la RPC, qui refuse d'écrire si
 * quoi que ce soit a bougé entre la validation et l'écriture.
 */
@Injectable()
export class SavingsGoalWithdrawalPolicyService implements SavingsGoalWithdrawalPolicyPort {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
  ) {}

  async runAgainstBalance<T>(input: SavingsGoalWithdrawalWrite<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const balance = await this.readBalance(input.goalId, input.user);
      this.assertSufficient(balance.confirmed, input);

      try {
        return await input.write(balance.revision);
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS || !isBalanceConflict(error)) throw error;
        // Le solde relu peut avoir fondu entre-temps : le tour suivant le
        // revalide, donc un retrait concurrent qui a vidé le pot ressort en
        // solde insuffisant et non en conflit, qui ne dirait rien à personne.
      }
    }
  }

  /**
   * Révision d'ABORD, matière du solde ensuite : toute écriture concurrente
   * incrémente la révision, donc celle qu'on emporte ne peut que devenir
   * périmée — et la RPC refuse. Lue après les lignes, elle certifierait au
   * contraire un solde déjà dépassé, et l'écriture passerait.
   */
  private async readBalance(
    goalId: string,
    user: AuthenticatedUser,
  ): Promise<Balance> {
    const revision = await this.repo.findBalanceRevision(goalId);
    if (revision === null) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND,
        { id: goalId },
        {
          operation: 'savingsGoal.withdrawal.readBalance',
          entityId: goalId,
          userId: user.id,
        },
      );
    }

    // La révision est déjà lue et validée ; le reste ne se contraint plus entre
    // soi, y compris la ligne de l'objectif — ses champs nourrissent le calcul,
    // ils n'arbitrent rien. Les laisser en séquence coûtait un aller-retour.
    const [goal, { lines, transactions }, withdrawals] = await Promise.all([
      this.repo.findById(goalId),
      this.repo.findLinkedContributions(goalId),
      this.repo.findLinkedWithdrawals(goalId),
    ]);

    const { confirmed } = computeSavingsGoalProgress({
      targetAmount: goal.targetAmount,
      status: goal.status,
      createdAt: goal.createdAt,
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      payDayOfMonth: user.payDayOfMonth ?? null,
      initialAmount: goal.initialAmount ?? 0,
      lines,
      transactions,
      withdrawals,
    });

    return { confirmed, revision };
  }

  /**
   * Sur une ÉDITION, l'ancien montant est rendu au pot avant l'arbitrage : la
   * comparaison porte sur l'état du monde une fois le retrait remplacé, sinon
   * augmenter un retrait de 10 CHF exigerait de disposer de son montant entier
   * une seconde fois.
   */
  private assertSufficient(
    confirmed: number,
    input: SavingsGoalWithdrawalWrite<unknown>,
  ): void {
    // Rien n'est prélevé : le solde n'a rien à défendre, et la révision porte
    // seule la garantie de concurrence sur ce chemin. Une suppression arrive
    // ici avec `debit: 0` — c'est le geste qui REND l'argent au pot, refuser
    // parce que le stock est déjà négatif laisserait la transaction en
    // cul-de-sac, sans aucun chemin pour la réparer.
    if (input.debit <= 0) return;

    const available = confirmed + (input.creditBack ?? 0);
    if (input.debit <= available + WITHDRAWAL_BALANCE_TOLERANCE) return;

    // Le message ne porte AUCUN chiffre : le solde d'un objectif est une donnée
    // financière, et une réponse d'erreur voyage jusque dans les logs.
    throw new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE,
      undefined,
      {
        operation: 'savingsGoal.withdrawal.assertSufficient',
        entityId: input.goalId,
        userId: input.user.id,
      },
    );
  }
}

function isBalanceConflict(error: unknown): boolean {
  return (
    error instanceof BusinessException &&
    error.code === ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_CONFLICT.code
  );
}
