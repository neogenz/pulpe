import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CleanupExpiredDemoUsersUseCase } from '../../application/cleanup-expired-demo-users.use-case';

@Injectable()
export class DemoCleanupCron {
  constructor(
    private readonly cleanupExpired: CleanupExpiredDemoUsersUseCase,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async runCleanup(): Promise<void> {
    await this.cleanupExpired.execute();
  }
}
