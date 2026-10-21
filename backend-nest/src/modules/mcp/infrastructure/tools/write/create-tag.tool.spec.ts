import { describe, expect, it, mock } from 'bun:test';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import type { Tag } from '@modules/tag/domain/tag.entity';
import type { TagWritePort } from '@modules/tag/domain/ports/tag-write.port';
import { CreateTagTool } from './create-tag.tool';

const ID = '11111111-1111-4111-8111-111111111111';

function setup(create: TagWritePort['create']) {
  const port = {
    create: mock(create),
    rename: mock(async () => ({}) as Tag),
    remove: mock(async () => {}),
  } satisfies TagWritePort;
  return { port, tool: new CreateTagTool(port) };
}

describe('CreateTagTool', () => {
  it('should create the tag and name its id', async () => {
    const { port, tool } = setup(async (name) => ({ id: ID, name }) as Tag);

    const result = await tool.execute({ name: 'Courses' });

    expect(port.create).toHaveBeenCalledWith('Courses');
    expect(result.text).toBe(`Tag créé (id ${ID}) : « Courses ».`);
  });

  it('should let an unrelated failure through unchanged', async () => {
    const failure = new BusinessException(ERROR_DEFINITIONS.TAG_CREATE_FAILED);
    const { tool } = setup(async () => {
      throw failure;
    });

    await expect(tool.execute({ name: 'Courses' })).rejects.toBe(failure);
  });

  it('should be a non-destructive read_write tool', () => {
    const { tool } = setup(async () => ({}) as Tag);

    expect(tool.name).toBe('create_tag');
    expect(tool.mode).toBe('read_write');
    expect(tool.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
  });
});
