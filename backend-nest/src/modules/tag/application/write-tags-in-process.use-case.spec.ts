import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { Tag } from '../domain/tag.entity';
import type { CreateTagUseCase } from './create-tag.use-case';
import type { FindTagUseCase } from './find-tag.use-case';
import type { RemoveTagUseCase } from './remove-tag.use-case';
import type { UpdateTagUseCase } from './update-tag.use-case';
import { WriteTagsInProcessUseCase } from './write-tags-in-process.use-case';

const user = { id: 'user-1' };
const session = { user } as unknown as AuthenticatedSupabaseProvider;
const tag = { id: 'tag-1', name: 'Courses' } as Tag;

describe('WriteTagsInProcessUseCase', () => {
  const calls: string[] = [];
  let createTag: CreateTagUseCase;
  let updateTag: UpdateTagUseCase;
  let findTag: FindTagUseCase;
  let removeTag: RemoveTagUseCase;
  let port: WriteTagsInProcessUseCase;

  beforeEach(() => {
    calls.length = 0;
    createTag = {
      execute: mock(async () => tag),
    } as unknown as CreateTagUseCase;
    updateTag = {
      execute: mock(async () => tag),
    } as unknown as UpdateTagUseCase;
    findTag = {
      execute: mock(async () => {
        calls.push('find');
        return tag;
      }),
    } as unknown as FindTagUseCase;
    removeTag = {
      execute: mock(async () => {
        calls.push('remove');
      }),
    } as unknown as RemoveTagUseCase;
    port = new WriteTagsInProcessUseCase(
      createTag,
      updateTag,
      findTag,
      removeTag,
      session,
    );
  });

  it('should create a tag from its name', async () => {
    await expect(port.create('Courses')).resolves.toBe(tag);

    expect(createTag.execute).toHaveBeenCalledWith({ name: 'Courses' }, user);
  });

  it('should rename a tag with the new name only', async () => {
    await expect(port.rename('tag-1', 'Maison')).resolves.toBe(tag);

    expect(updateTag.execute).toHaveBeenCalledWith(
      'tag-1',
      { name: 'Maison' },
      user,
    );
  });

  it.each([
    ['TAG_NOT_FOUND', ERROR_DEFINITIONS.TAG_NOT_FOUND],
    ['TAG_ALREADY_EXISTS', ERROR_DEFINITIONS.TAG_ALREADY_EXISTS],
  ] as const)('should surface %s from a rename', async (_name, definition) => {
    (updateTag.execute as ReturnType<typeof mock>).mockRejectedValue(
      new BusinessException(definition),
    );

    await expect(port.rename('tag-1', 'Maison')).rejects.toMatchObject({
      code: definition.code,
    });
  });

  it('should find the tag before removing it', async () => {
    await port.remove('tag-1');

    expect(calls).toEqual(['find', 'remove']);
    expect(removeTag.execute).toHaveBeenCalledWith('tag-1', user);
  });

  it('should reject TAG_NOT_FOUND and delete nothing for an unknown id', async () => {
    (findTag.execute as ReturnType<typeof mock>).mockRejectedValue(
      new BusinessException(ERROR_DEFINITIONS.TAG_NOT_FOUND, { id: 'nope' }),
    );

    await expect(port.remove('nope')).rejects.toMatchObject({
      code: ERROR_DEFINITIONS.TAG_NOT_FOUND.code,
      status: 404,
    });
    expect(removeTag.execute).not.toHaveBeenCalled();
  });
});
