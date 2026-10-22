import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  BUDGET_TEMPLATE_WRITE_PORT,
  type BudgetTemplateWritePort,
} from '@modules/budget-template/domain/ports/budget-template-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';

const inputSchema = {
  templateId: z.uuid().describe('Modèle à supprimer'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class DeleteTemplateTool implements McpTool<Args> {
  readonly name = 'delete_template';
  readonly title = 'Supprimer un modèle';
  readonly description =
    'Supprime un modèle de mois et ses prévisions. Refusé tant qu’un mois a été créé depuis ce modèle : la réponse liste ces mois. À n’appeler qu’après confirmation explicite de l’utilisateur.';
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
    // A used template makes the port reject with TEMPLATE_IN_USE (months
    // listed): the error reaches the model and the activity log says `error`.
    await this.templates.remove(args.templateId);
    return { text: `Modèle supprimé (id ${args.templateId}).` };
  }
}
