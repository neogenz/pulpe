import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/domain/ports/encryption.port';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../domain/ports/user-repository.port';
import type { ScheduledAccountDeletion } from '../domain/user.entity';

/**
 * `DELETE /users/account` — schedules deletion in `app_metadata` and signs
 * the user out globally. Idempotent: returns the existing
 * `scheduledDeletionAt` if already set, without re-scheduling but still
 * triggering the global sign-out.
 *
 * Order matters: schedule FIRST. If signOut fails afterwards, the user stays
 * scheduled (eventual consistency); if we signed out first and then failed
 * to schedule, the user would be locked out without a deletion record.
 */
@Injectable()
export class ScheduleAccountDeletionUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: UserRepositoryPort,
    @Inject(ENCRYPTION_PORT)
    private readonly encryption: EncryptionPort,
    @InjectInfoLogger(ScheduleAccountDeletionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(user: AuthenticatedUser): Promise<ScheduledAccountDeletion> {
    const keyIsValid = await this.encryption.verifyAndEnsureKeyCheck(
      user.id,
      user.clientKey,
    );
    if (!keyIsValid) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED,
      );
    }

    const result = await this.repo.scheduleDeletion(user.id);
    await this.repo.signOutGlobally(user.accessToken);

    this.logger.info(
      {
        userId: user.id,
        operation: 'user.scheduleDeletion',
        alreadyScheduled: result.alreadyScheduled,
      },
      result.alreadyScheduled
        ? 'Account deletion already scheduled, signing out'
        : 'Account deletion scheduled',
    );

    return {
      scheduledDeletionAt: result.scheduledDeletionAt,
      alreadyScheduled: result.alreadyScheduled,
    };
  }
}
