import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  TAG_REPOSITORY,
  type TagRepositoryPort,
} from '../domain/ports/tag-repository.port';
import type { Tag } from '../domain/tag.entity';

@Injectable()
export class FindAllTagsUseCase {
  constructor(
    @Inject(TAG_REPOSITORY)
    private readonly repo: TagRepositoryPort,
    @InjectInfoLogger(FindAllTagsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(user: AuthenticatedUser): Promise<Tag[]> {
    const entities = await this.repo.findAll();

    this.logger.info(
      { userId: user.id, count: entities.length, operation: 'tag.findAll' },
      'Tags fetched',
    );

    return entities;
  }
}
