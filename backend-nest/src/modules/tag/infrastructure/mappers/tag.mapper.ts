import { Injectable } from '@nestjs/common';
import {
  type Tag as TagApi,
  type TagHistory as TagHistoryApi,
} from 'pulpe-shared';
import type { Tag, TagHistory } from '../../domain/tag.entity';

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

  toHistoryApi(history: TagHistory): TagHistoryApi {
    return {
      tagId: history.tagId,
      periods: history.periods,
      totalPlanned: history.totalPlanned,
      totalActual: history.totalActual,
      monthlyAverageActual: history.monthlyAverageActual,
      actualToPlannedPercent: history.actualToPlannedPercent,
    };
  }
}
