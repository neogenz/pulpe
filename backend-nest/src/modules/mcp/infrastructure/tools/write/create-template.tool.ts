import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  BUDGET_TEMPLATE_WRITE_PORT,
  type BudgetTemplateWritePort,
} from '@modules/budget-template/domain/ports/budget-template-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';

const inputSchema = {
  name: z.string().min(1).max(100).describe('Nom du modèle'),
  description: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .describe('Description libre du modèle, facultative'),
  isDefault: z
    .boolean()
    .optional()
    .describe(
      'En faire le modèle par défaut, seulement si l’utilisateur le demande',
    ),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class CreateTemplateTool implements McpTool<Args> {
  readonly name = 'create_template';
  readonly title = 'Créer un modèle';
  readonly description =
    'Crée un modèle de mois vide, à remplir ensuite avec edit_template_lines. 5 modèles au plus par utilisateur.';
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
    const { template } = await this.templates.create({
      name: args.name,
      description: args.description,
      isDefault: args.isDefault ?? false,
      lines: [],
    });
    return {
      text: `Modèle créé (id ${template.id}) : ${template.name}. Ajoute ses prévisions avec edit_template_lines.`,
    };
  }
}
