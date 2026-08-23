import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { budgetSchema } from 'pulpe-shared';
import {
  BUDGET_WRITE_PORT,
  type BudgetWritePort,
} from '@modules/budget/domain/ports/budget-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { askUser } from './elicitation';

const inputSchema = {
  month: budgetSchema.shape.month.describe('Mois à créer, 1 pour janvier'),
  year: budgetSchema.shape.year.describe('Année du mois à créer'),
  templateId: z
    .uuid()
    .optional()
    .describe(
      'Modèle de mois à appliquer. Les modèles sont dans list_templates',
    ),
  description: z
    .string()
    .max(500)
    .optional()
    .describe('Description libre du mois, facultative'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class CreateMonthFromTemplateTool implements McpTool<Args> {
  readonly name = 'create_month_from_template';
  readonly title = 'Créer le budget d’un mois';
  readonly description =
    'Crée le budget d’un mois à partir d’un modèle de mois : le mois arrive avec toutes les prévisions du modèle.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(BUDGET_WRITE_PORT)
    private readonly budgets: BudgetWritePort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    // A month is born with every prévision of its template. Picking the wrong
    // one fills the month with amounts the user never asked for.
    if (!args.templateId) {
      return askUser(
        'quel modèle de mois appliquer. Liste-les avec list_templates, puis rappelle create_month_from_template avec templateId.',
      );
    }

    const budget = await this.budgets.createFromTemplate({
      month: args.month,
      year: args.year,
      templateId: args.templateId,
      description: args.description ?? '',
    });
    return {
      text: `Budget créé pour ${budget.month}/${budget.year} (id ${budget.id}).`,
    };
  }
}
