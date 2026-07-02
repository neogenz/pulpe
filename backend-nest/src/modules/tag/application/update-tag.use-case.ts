import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type TagUpdate } from 'pulpe-shared';
import {
  TAG_REPOSITORY,
  type TagRepositoryPort,
} from '../domain/ports/tag-repository.port';
import type { Tag, TagUpdatePatch } from '../domain/tag.entity';

@Injectable()
export class UpdateTagUseCase {
  constructor(
    @Inject(TAG_REPOSITORY)
    private readonly repo: TagRepositoryPort,
    @InjectInfoLogger(UpdateTagUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: TagUpdate,
    user: AuthenticatedUser,
  ): Promise<Tag> {
    const patch: TagUpdatePatch = {};
    if (dto.name !== undefined) patch.name = dto.name;

    const entity = await this.repo.update(id, patch);

    this.logger.info(
      { tagId: id, userId: user.id, operation: 'tag.update' },
      'Tag updated',
    );

    return entity;
  }
}
