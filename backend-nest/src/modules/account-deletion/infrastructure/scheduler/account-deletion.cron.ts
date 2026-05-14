import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CleanupExpiredDeletionsUseCase } from '../../application/cleanup-expired-deletions.use-case';

/**
 * Cron entry point for the account-deletion grace-period cleanup.
 * Schedule: daily at 02:00 UTC.
 */
@Injectable()
export class AccountDeletionCron {
  constructor(
    private readonly cleanupExpired: CleanupExpiredDeletionsUseCase,
  ) {}

  @Cron('0 2 * * *')
  async runCleanup(): Promise<void> {
    await this.cleanupExpired.execute();
  }
}
