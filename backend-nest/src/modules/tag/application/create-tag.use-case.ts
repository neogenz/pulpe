import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type TagCreate } from 'pulpe-shared';
import {
  TAG_REPOSITORY,
  type TagRepositoryPort,
} from '../domain/ports/tag-repository.port';
import type { Tag } from '../domain/tag.entity';

@Injectable()
export class CreateTagUseCase {
  constructor(
    @Inject(TAG_REPOSITORY)
    private readonly repo: TagRepositoryPort,
    @InjectInfoLogger(CreateTagUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(dto: TagCreate, user: AuthenticatedUser): Promise<Tag> {
    const entity = await this.repo.insert({ name: dto.name });

    this.logger.info(
      { tagId: entity.id, userId: user.id, operation: 'tag.create' },
      'Tag created',
    );

    return entity;
  }
}
