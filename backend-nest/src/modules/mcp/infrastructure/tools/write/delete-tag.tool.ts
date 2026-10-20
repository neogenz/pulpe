import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  TAG_WRITE_PORT,
  type TagWritePort,
} from '@modules/tag/domain/ports/tag-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { toTagToolError } from './tag-errors';

const inputSchema = {
  tagId: z.uuid().describe('Identifiant du tag à supprimer'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class DeleteTagTool implements McpTool<Args> {
  readonly name = 'delete_tag';
  readonly title = 'Supprimer un tag';
  readonly description =
    'Supprime définitivement un tag : il disparaît de toutes les prévisions, de tous les mouvements et des modèles qui le portent. À n’appeler qu’après confirmation explicite de l’utilisateur.';
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
      await this.tags.remove(args.tagId);
      return { text: `Tag supprimé (id ${args.tagId}).` };
    } catch (error) {
      throw toTagToolError(error);
    }
  }
}
