import { Inject, Injectable } from '@nestjs/common';
import {
  TAG_READ_PORT,
  type TagReadPort,
} from '@modules/tag/domain/ports/tag-read.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';

@Injectable()
export class ListTagsTool implements McpTool {
  readonly name = 'list_tags';
  readonly title = 'Mes tags';
  readonly description =
    'Liste les tags de l’utilisateur avec leur id. Sert à choisir les tags à poser avec tag_items, ou à filtrer search_movements.';
  readonly mode = 'read' as const;
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = {};

  constructor(
    @Inject(TAG_READ_PORT)
    private readonly tags: TagReadPort,
  ) {}

  async execute(): Promise<McpToolResult> {
    const tags = await this.tags.list();
    if (tags.length === 0) {
      return { text: 'Aucun tag.' };
    }
    return {
      text: [
        `Tags (${tags.length})`,
        ...tags.map((t) => `- [${t.id}] ${t.name}`),
      ].join('\n'),
    };
  }
}
