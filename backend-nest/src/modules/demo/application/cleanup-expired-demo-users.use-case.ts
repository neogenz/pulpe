import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import {
  DEMO_CREDENTIALS_PORT,
  type DemoCredentialsPort,
} from '../domain/ports/demo-credentials.port';
import { DEMO_RETENTION_HOURS } from '../domain/demo.constants';

@Injectable()
export class CleanupExpiredDemoUsersUseCase {
  constructor(
    @Inject(DEMO_CREDENTIALS_PORT)
    private readonly creds: DemoCredentialsPort,
    @InjectInfoLogger(CleanupExpiredDemoUsersUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(): Promise<void> {
    const startTime = Date.now();
    this.logger.info('Starting demo users cleanup job');

    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - DEMO_RETENTION_HOURS);

      this.logger.info(
        { cutoffTime: cutoffTime.toISOString() },
        'Cutoff time calculated',
      );

      const expiredUsers = await this.creds.listExpiredDemoUsers(
        cutoffTime,
        false,
      );

      if (expiredUsers.length === 0) {
        this.logger.info('No expired demo users to cleanup');
        return;
      }

      const userIds = expiredUsers.map((u) => u.id);
      const { fulfilled, rejected } = await this.creds.bulkDeleteUsers(userIds);

      this.logger.info(
        {
          total: expiredUsers.length,
          succeeded: fulfilled.length,
          failed: rejected.length,
          duration: Date.now() - startTime,
        },
        'Demo users cleanup job completed',
      );
    } catch (error) {
      this.logger.warn(
        { err: error, duration: Date.now() - startTime },
        'Demo users cleanup job failed',
      );
    }
  }
}
