import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  TAG_REPOSITORY,
  type TagRepositoryPort,
} from '../domain/ports/tag-repository.port';
import type { Tag } from '../domain/tag.entity';

@Injectable()
export class FindTagUseCase {
  constructor(
    @Inject(TAG_REPOSITORY)
    private readonly repo: TagRepositoryPort,
    @InjectInfoLogger(FindTagUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Tag> {
    const entity = await this.repo.findById(id);

    this.logger.info(
      { tagId: id, userId: user.id, operation: 'tag.findOne' },
      'Tag fetched',
    );

    return entity;
  }
}
