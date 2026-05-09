import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import {
  ACCOUNT_DELETION_REPOSITORY,
  type AccountDeletionRepositoryPort,
} from '../domain/ports/account-deletion-repository.port';
import type { ScheduledDeletionUser } from '../domain/account-deletion.entity';

const SUMMARY_OP = 'accountDeletion.cleanup.summary';
const FATAL_OP = 'accountDeletion.cleanup.fatal';

interface CleanupSummary {
  op: typeof SUMMARY_OP;
  severity: 'critical' | 'normal';
  scheduledCount: number;
  deletedCount: number;
  failedCount: number;
  duration: number;
}

/**
 * Use case responsible for cleaning up accounts whose grace period has expired.
 *
 * Tables cleaned via CASCADE when the auth user is deleted:
 * - template (user_id) -> template_line (template_id)
 * - monthly_budget (user_id) -> budget_line (budget_id), transaction (budget_id)
 * - savings_goal (user_id)
 *
 * Alerting: failure paths emit `severity: 'critical'` with `op` tag —
 * matchable in PostHog/Sentry/structured logs to escalate RGPD-impacting
 * deletion failures (Art. 17).
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
      this.#logSummary(deleteResults, expiredUsers.length, startTime);
    } catch (error) {
      this.logger.warn(
        {
          op: FATAL_OP,
          severity: 'critical',
          err: error,
          duration: Date.now() - startTime,
        },
        'Scheduled account deletion cleanup job failed — RGPD deletions may be delayed',
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

  #logSummary(
    deleteResults: PromiseSettledResult<void>[],
    scheduledCount: number,
    startTime: number,
  ): void {
    const deletedCount = deleteResults.filter(
      (r) => r.status === 'fulfilled',
    ).length;
    const failedCount = deleteResults.filter(
      (r) => r.status === 'rejected',
    ).length;

    const summary: CleanupSummary = {
      op: SUMMARY_OP,
      severity: failedCount > 0 ? 'critical' : 'normal',
      scheduledCount,
      deletedCount,
      failedCount,
      duration: Date.now() - startTime,
    };

    if (failedCount > 0) {
      this.logger.warn(
        summary,
        'Scheduled account deletion cleanup completed with failures — RGPD escalation needed',
      );
      return;
    }

    this.logger.info(
      summary,
      'Scheduled account deletion cleanup job completed',
    );
  }
}
