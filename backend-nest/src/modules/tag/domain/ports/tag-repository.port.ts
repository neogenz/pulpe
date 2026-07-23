import type { BudgetPeriod } from 'pulpe-shared';
import type {
  Tag,
  TagCreateInput,
  TagHistoryContributions,
  TagUpdatePatch,
} from '../tag.entity';

export const TAG_REPOSITORY = Symbol('TAG_REPOSITORY');

export interface TagRepositoryPort {
  findAll(): Promise<Tag[]>;
  findById(id: string): Promise<Tag>;
  findHistoryContributions(
    id: string,
    startPeriod: BudgetPeriod,
    endPeriod: BudgetPeriod,
  ): Promise<TagHistoryContributions>;
  insert(input: TagCreateInput): Promise<Tag>;
  update(id: string, patch: TagUpdatePatch): Promise<Tag>;
  delete(id: string): Promise<void>;
}
