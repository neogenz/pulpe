import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  BUDGET_TEMPLATE_WRITE_PORT,
  type BudgetTemplateWritePort,
} from '@modules/budget-template/domain/ports/budget-template-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { askUser } from './elicitation';

const inputSchema = {
  templateId: z.uuid().describe('Modèle à modifier'),
  name: z.string().min(1).max(100).optional().describe('Nouveau nom'),
  description: z.string().max(500).optional().describe('Nouvelle description'),
  isDefault: z
    .boolean()
    .optional()
    .describe(
      'En faire le modèle par défaut, seulement si l’utilisateur le demande',
    ),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class UpdateTemplateTool implements McpTool<Args> {
  readonly name = 'update_template';
  readonly title = 'Modifier un modèle';
  readonly description =
    'Renomme un modèle, change sa description ou en fait le modèle par défaut. Seuls les champs fournis changent ; ses prévisions et les mois déjà créés ne bougent pas.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(BUDGET_TEMPLATE_WRITE_PORT)
    private readonly templates: BudgetTemplateWritePort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const { templateId, name, description, isDefault } = args;
    if (
      name === undefined &&
      description === undefined &&
      isDefault === undefined
    ) {
      return askUser(
        'ce qui change sur ce modèle : nom, description ou modèle par défaut, puis rappelle update_template.',
      );
    }

    const template = await this.templates.update(templateId, {
      name,
      description,
      isDefault,
    });
    return {
      text: `Modèle modifié (id ${template.id}) : ${template.name}${template.isDefault ? ' · par défaut' : ''}.`,
    };
  }
}
