import { Inject, Injectable } from '@nestjs/common';
import type {
  ReconciliationState,
  UpdateReconciliationState,
} from 'pulpe-shared';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { RECONCILIATION_STATE_REPOSITORY } from '../reconciliation.tokens';
import type { ReconciliationStateRepositoryPort } from '../domain/ports/reconciliation-state-repository.port';
import type { ReconciliationStatePatch } from '../domain/reconciliation-state.entity';

@Injectable()
export class UpdateReconciliationStateUseCase {
  constructor(
    @Inject(RECONCILIATION_STATE_REPOSITORY)
    private readonly repo: ReconciliationStateRepositoryPort,
    @InjectInfoLogger(UpdateReconciliationStateUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    input: UpdateReconciliationState,
    user: AuthenticatedUser,
  ): Promise<ReconciliationState> {
    const patch: ReconciliationStatePatch = {};
    if (input.startingAmount !== undefined) {
      // Cents only: TypeScript and Swift round a third decimal differently.
      patch.startingAmount = Math.round(input.startingAmount * 100) / 100;
    }
    if (input.completed) {
      patch.lastCompletedAt = new Date().toISOString();
    }

    const state = await this.repo.upsert(patch);

    this.logger.info(
      {
        userId: user.id,
        operation: 'reconciliation.updateState',
        fields: Object.keys(patch),
      },
      'Reconciliation state updated',
    );
    return {
      startingAmount: state.startingAmount,
      hasCompletedComparison: state.lastCompletedAt !== null,
    };
  }
}
