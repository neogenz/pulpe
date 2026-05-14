import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../domain/ports/user-repository.port';
import type {
  UpdateUserSettingsInput,
  UserSettings,
} from '../domain/user.entity';

@Injectable()
export class UpdateUserSettingsUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: UserRepositoryPort,
    @InjectInfoLogger(UpdateUserSettingsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    patch: UpdateUserSettingsInput,
    user: AuthenticatedUser,
  ): Promise<UserSettings> {
    const settings = await this.repo.updateSettings(user.id, patch);
    this.logger.info(
      { userId: user.id, operation: 'user.updateSettings' },
      'User settings updated',
    );
    return settings;
  }
}
