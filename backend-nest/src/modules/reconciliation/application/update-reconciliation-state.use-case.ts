import { Inject, Injectable } from '@nestjs/common';
import type {
  ReconciliationState,
  UpdateReconciliationState,
} from 'pulpe-shared';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  RECONCILIATION_STATE_REPOSITORY,
  type ReconciliationStateRepositoryPort,
} from '../domain/ports/reconciliation-state-repository.port';
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
    // A starting amount from iOS 1.14.2 is accepted and ignored.
    const patch: ReconciliationStatePatch = {};
    if (input.completed) {
      patch.lastCompletedAt = new Date().toISOString();
    }

    await this.repo.upsert(patch);

    this.logger.info(
      {
        userId: user.id,
        operation: 'reconciliation.updateState',
        fields: Object.keys(patch),
      },
      'Reconciliation state updated',
    );
    // Always completed, like the GET: iOS 1.14.2 asks nothing more then.
    return { startingAmount: 0, hasCompletedComparison: true };
  }
}
