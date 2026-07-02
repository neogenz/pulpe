import { Injectable } from '@nestjs/common';
import { type Tag as TagApi } from 'pulpe-shared';
import type { Tag } from '../../domain/tag.entity';

@Injectable()
export class TagMapper {
  toApi(entity: Tag): TagApi {
    return {
      id: entity.id,
      userId: entity.userId,
      name: entity.name,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  toApiList(entities: Tag[]): TagApi[] {
    return entities.map((entity) => this.toApi(entity));
  }
}
