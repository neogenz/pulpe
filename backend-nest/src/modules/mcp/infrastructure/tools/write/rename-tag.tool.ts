import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { tagCreateSchema } from 'pulpe-shared';
import {
  TAG_WRITE_PORT,
  type TagWritePort,
} from '@modules/tag/domain/ports/tag-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { toTagToolError } from './tag-errors';

const inputSchema = {
  tagId: z.uuid().describe('Identifiant du tag à renommer'),
  name: tagCreateSchema.shape.name.describe('Nouveau nom, 1 à 30 caractères'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class RenameTagTool implements McpTool<Args> {
  readonly name = 'rename_tag';
  readonly title = 'Renommer un tag';
  readonly description =
    'Renomme un tag. Le nouveau nom s’affiche partout où le tag est posé.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(TAG_WRITE_PORT)
    private readonly tags: TagWritePort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    try {
      const tag = await this.tags.rename(args.tagId, args.name);
      return { text: `Tag renommé (id ${tag.id}) : « ${tag.name} ».` };
    } catch (error) {
      throw toTagToolError(error, args.name);
    }
  }
}
