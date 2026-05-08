import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import {
  ACCOUNT_DELETION_REPOSITORY,
  type AccountDeletionRepositoryPort,
} from '../domain/ports/account-deletion-repository.port';
import type { ScheduledDeletionUser } from '../domain/account-deletion.entity';

/**
 * Use case responsible for cleaning up accounts whose grace period has expired.
 *
 * Tables cleaned via CASCADE when the auth user is deleted:
 * - template (user_id) -> template_line (template_id)
 * - monthly_budget (user_id) -> budget_line (budget_id), transaction (budget_id)
 * - savings_goal (user_id)
 */
@Injectable()
export class CleanupExpiredDeletionsUseCase {
  constructor(
    @Inject(ACCOUNT_DELETION_REPOSITORY)
    private readonly repo: AccountDeletionRepositoryPort,
    @InjectInfoLogger(CleanupExpiredDeletionsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(): Promise<void> {
    const startTime = Date.now();
    this.logger.info('Starting scheduled account deletion cleanup job');

    try {
      const expiredUsers = await this.repo.listExpiredScheduledUsers(
        new Date(),
      );

      if (expiredUsers.length === 0) {
        this.logger.info('No expired scheduled deletions to process');
        return;
      }

      const deleteResults = await this.#deleteUsers(expiredUsers);
      this.#logResults(deleteResults, expiredUsers.length, startTime);
    } catch (error) {
      this.logger.warn(
        { err: error, duration: Date.now() - startTime },
        'Scheduled account deletion cleanup job failed',
      );
    }
  }

  async #deleteUsers(
    users: ScheduledDeletionUser[],
  ): Promise<PromiseSettledResult<void>[]> {
    return Promise.allSettled(
      users.map(async (user) => {
        try {
          await this.repo.deleteUser(user.id);
          this.logger.info(
            { userId: user.id, email: user.email },
            'Scheduled account deleted successfully',
          );
        } catch (error) {
          this.logger.warn(
            { userId: user.id, email: user.email, err: error },
            'Failed to delete scheduled account',
          );
          throw error;
        }
      }),
    );
  }

  #logResults(
    deleteResults: PromiseSettledResult<void>[],
    total: number,
    startTime: number,
  ): void {
    const succeeded = deleteResults.filter(
      (r) => r.status === 'fulfilled',
    ).length;
    const failed = deleteResults.filter((r) => r.status === 'rejected').length;

    this.logger.info(
      {
        total,
        succeeded,
        failed,
        duration: Date.now() - startTime,
      },
      'Scheduled account deletion cleanup job completed',
    );
  }
}
