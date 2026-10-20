import { describe, expect, it, mock } from 'bun:test';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import type { Tag } from '@modules/tag/domain/tag.entity';
import type { TagWritePort } from '@modules/tag/domain/ports/tag-write.port';
import { DeleteTagTool } from './delete-tag.tool';

const ID = '11111111-1111-4111-8111-111111111111';

function setup(remove: TagWritePort['remove']) {
  const port = {
    create: mock(async () => ({}) as Tag),
    rename: mock(async () => ({}) as Tag),
    remove: mock(remove),
  } satisfies TagWritePort;
  return { port, tool: new DeleteTagTool(port) };
}

describe('DeleteTagTool', () => {
  it('should delete the tag and confirm it', async () => {
    const { port, tool } = setup(async () => {});

    const result = await tool.execute({ tagId: ID });

    expect(port.remove).toHaveBeenCalledWith(ID);
    expect(result.text).toBe(`Tag supprimé (id ${ID}).`);
  });

  it('should reject an unknown tag with a French 404, never a success text', async () => {
    const { tool } = setup(async () => {
      throw new BusinessException(ERROR_DEFINITIONS.TAG_NOT_FOUND, { id: ID });
    });

    const failure = await tool.execute({ tagId: ID }).catch((e) => e);

    expect(failure.getStatus()).toBe(404);
    expect(failure.message).toContain('Tag introuvable');
  });

  it('should let a 500 BusinessException through untouched', async () => {
    const failure = new BusinessException(ERROR_DEFINITIONS.TAG_DELETE_FAILED);
    const { tool } = setup(async () => {
      throw failure;
    });

    await expect(tool.execute({ tagId: ID })).rejects.toBe(failure);
  });

  it('should warn that the tag leaves every prévision and mouvement, and be destructive and idempotent', () => {
    const { tool } = setup(async () => {});

    expect(tool.name).toBe('delete_tag');
    expect(tool.mode).toBe('read_write');
    expect(tool.description).toContain('prévisions');
    expect(tool.description).toContain('mouvements');
    expect(tool.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
  });
});
