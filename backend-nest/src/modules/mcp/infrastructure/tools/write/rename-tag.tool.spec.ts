import { describe, expect, it, mock } from 'bun:test';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import type { Tag } from '@modules/tag/domain/tag.entity';
import type { TagWritePort } from '@modules/tag/domain/ports/tag-write.port';
import { RenameTagTool } from './rename-tag.tool';

const ID = '11111111-1111-4111-8111-111111111111';

function setup(rename: TagWritePort['rename']) {
  const port = {
    create: mock(async () => ({}) as Tag),
    rename: mock(rename),
    remove: mock(async () => {}),
  } satisfies TagWritePort;
  return { port, tool: new RenameTagTool(port) };
}

describe('RenameTagTool', () => {
  it('should rename the tag and give its new name', async () => {
    const { port, tool } = setup(async (id, name) => ({ id, name }) as Tag);

    const result = await tool.execute({ tagId: ID, name: 'Maison' });

    expect(port.rename).toHaveBeenCalledWith(ID, 'Maison');
    expect(result.text).toBe(`Tag renommé (id ${ID}) : « Maison ».`);
  });

  it('should let the port refusal through for the controller to word', async () => {
    const failure = new BusinessException(ERROR_DEFINITIONS.TAG_NOT_FOUND, {
      id: ID,
    });
    const { tool } = setup(async () => {
      throw failure;
    });

    await expect(tool.execute({ tagId: ID, name: 'Maison' })).rejects.toBe(
      failure,
    );
  });

  it('should be an idempotent destructive read_write tool', () => {
    const { tool } = setup(async () => ({}) as Tag);

    expect(tool.name).toBe('rename_tag');
    expect(tool.mode).toBe('read_write');
    expect(tool.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
  });
});
