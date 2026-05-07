import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import {
  DEMO_CREDENTIALS_PORT,
  type DemoCredentialsPort,
} from '../domain/ports/demo-credentials.port';

@Injectable()
export class CleanupDemoUsersByAgeUseCase {
  constructor(
    @Inject(DEMO_CREDENTIALS_PORT)
    private readonly creds: DemoCredentialsPort,
    @InjectInfoLogger(CleanupDemoUsersByAgeUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    maxAgeHours: number,
  ): Promise<{ deleted: number; failed: number }> {
    this.logger.info({ maxAgeHours }, 'Manual cleanup triggered');

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

    const expiredUsers = await this.creds.listExpiredDemoUsers(
      cutoffTime,
      true,
    );

    const userIds = expiredUsers.map((u) => u.id);
    const { fulfilled, rejected } = await this.creds.bulkDeleteUsers(userIds);

    this.logger.info(
      { deleted: fulfilled.length, failed: rejected.length },
      'Manual cleanup completed',
    );

    return { deleted: fulfilled.length, failed: rejected.length };
  }
}
