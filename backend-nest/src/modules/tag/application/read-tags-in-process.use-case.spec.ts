import { describe, expect, it, mock } from 'bun:test';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { Tag } from '../domain/tag.entity';
import type { FindAllTagsUseCase } from './find-all-tags.use-case';
import { ReadTagsInProcessUseCase } from './read-tags-in-process.use-case';

const user = { id: 'user-1' };
const session = { user } as unknown as AuthenticatedSupabaseProvider;

describe('ReadTagsInProcessUseCase', () => {
  it('should return what FindAllTagsUseCase returns for the session user', async () => {
    const tags = [{ id: 'tag-1', name: 'Courses' }] as Tag[];
    const findAll = {
      execute: mock(async () => tags),
    } as unknown as FindAllTagsUseCase;

    const result = await new ReadTagsInProcessUseCase(findAll, session).list();

    expect(result).toBe(tags);
    expect(findAll.execute).toHaveBeenCalledTimes(1);
    expect(findAll.execute).toHaveBeenCalledWith(user);
  });
});
