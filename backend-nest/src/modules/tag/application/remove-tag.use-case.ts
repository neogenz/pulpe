import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { CacheService } from '@modules/cache/cache.service';
import {
  TAG_REPOSITORY,
  type TagRepositoryPort,
} from '../domain/ports/tag-repository.port';

@Injectable()
export class RemoveTagUseCase {
  constructor(
    @Inject(TAG_REPOSITORY)
    private readonly repo: TagRepositoryPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(RemoveTagUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<void> {
    await this.repo.delete(id);
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      { tagId: id, userId: user.id, operation: 'tag.remove' },
      'Tag deleted',
    );
  }
}
