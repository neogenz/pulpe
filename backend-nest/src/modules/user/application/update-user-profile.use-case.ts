import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../domain/ports/user-repository.port';
import { UserInvariants } from '../domain/user.invariants';
import type {
  UpdateUserProfileInput,
  UserProfile,
} from '../domain/user.entity';

@Injectable()
export class UpdateUserProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: UserRepositoryPort,
    @InjectInfoLogger(UpdateUserProfileUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    input: UpdateUserProfileInput,
    user: AuthenticatedUser,
  ): Promise<UserProfile> {
    UserInvariants.validateProfileUpdate(input);
    const profile = await this.repo.updateProfile(input);
    this.logger.info(
      { userId: user.id, operation: 'user.updateProfile' },
      'User profile updated',
    );
    return profile;
  }
}
