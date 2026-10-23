import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  BUDGET_TEMPLATE_WRITE_PORT,
  type BudgetTemplateWritePort,
} from '@modules/budget-template/domain/ports/budget-template-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';

const inputSchema = {
  templateId: z.uuid().describe('Modèle à copier'),
  name: z.string().min(1).max(100).describe('Nom de la copie'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class DuplicateTemplateTool implements McpTool<Args> {
  readonly name = 'duplicate_template';
  readonly title = 'Dupliquer un modèle';
  readonly description =
    'Copie un modèle sous un nouveau nom avec toutes ses prévisions et leurs tags, pour en faire une variante (par exemple « Mois été »). La copie n’est jamais le modèle par défaut. 5 modèles au plus par utilisateur.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(BUDGET_TEMPLATE_WRITE_PORT)
    private readonly templates: BudgetTemplateWritePort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const { template, lines } = await this.templates.duplicate(
      args.templateId,
      args.name,
    );
    return {
      text: `Modèle dupliqué (id ${template.id}) : ${template.name}. Prévisions copiées : ${lines.length}. La copie n’est pas le modèle par défaut.`,
    };
  }
}
