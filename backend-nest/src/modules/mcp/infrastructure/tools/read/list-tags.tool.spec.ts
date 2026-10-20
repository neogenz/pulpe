import { describe, expect, it } from 'bun:test';
import type { Tag } from '@modules/tag/domain/tag.entity';
import type { TagReadPort } from '@modules/tag/domain/ports/tag-read.port';
import { ListTagsTool } from './list-tags.tool';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const toolFor = (tags: Pick<Tag, 'id' | 'name'>[]) =>
  new ListTagsTool({ list: async () => tags as Tag[] } satisfies TagReadPort);

describe('ListTagsTool', () => {
  it('should list one line per tag with its id and name', async () => {
    const result = await toolFor([
      { id: ID_A, name: 'Courses' },
      { id: ID_B, name: 'Loisirs' },
    ]).execute();

    expect(result.text).toBe(
      ['Tags (2)', `- [${ID_A}] Courses`, `- [${ID_B}] Loisirs`].join('\n'),
    );
  });

  it('should say there is no tag when the user has none', async () => {
    expect((await toolFor([]).execute()).text).toBe('Aucun tag.');
  });

  it('should be a read tool, hence listed for read-only connections', () => {
    const tool = toolFor([]);

    expect(tool.name).toBe('list_tags');
    expect(tool.mode).toBe('read');
    expect(tool.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });
});
