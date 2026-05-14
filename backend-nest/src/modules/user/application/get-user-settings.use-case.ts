import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../domain/ports/user-repository.port';
import type { UserSettings } from '../domain/user.entity';

@Injectable()
export class GetUserSettingsUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: UserRepositoryPort,
  ) {}

  execute(): Promise<UserSettings> {
    return this.repo.findSettings();
  }
}
