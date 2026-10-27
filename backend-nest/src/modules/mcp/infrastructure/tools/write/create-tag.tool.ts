import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { tagCreateSchema } from 'pulpe-shared';
import {
  TAG_WRITE_PORT,
  type TagWritePort,
} from '@modules/tag/domain/ports/tag-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';

const inputSchema = {
  // Trims like the REST route; the MCP SDK hands the tool the parsed value.
  name: tagCreateSchema.shape.name.describe('Nom du tag, 1 à 30 caractères'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class CreateTagTool implements McpTool<Args> {
  readonly name = 'create_tag';
  readonly title = 'Créer un tag';
  readonly description =
    'Crée un tag. Un nom déjà pris, casse ignorée, est refusé : réutilise alors le tag existant (list_tags).';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(TAG_WRITE_PORT)
    private readonly tags: TagWritePort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const tag = await this.tags.create(args.name);
    return { text: `Tag créé (id ${tag.id}) : « ${tag.name} ».` };
  }
}
