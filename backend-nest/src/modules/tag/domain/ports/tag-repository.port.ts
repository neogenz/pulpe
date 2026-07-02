import type { Tag, TagCreateInput, TagUpdatePatch } from '../tag.entity';

export const TAG_REPOSITORY = Symbol('TAG_REPOSITORY');

export interface TagRepositoryPort {
  findAll(): Promise<Tag[]>;
  findById(id: string): Promise<Tag>;
  insert(input: TagCreateInput): Promise<Tag>;
  update(id: string, patch: TagUpdatePatch): Promise<Tag>;
  delete(id: string): Promise<void>;
}
