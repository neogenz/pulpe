import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { budgetSchema } from 'pulpe-shared';
import {
  BUDGET_MONTH_READ_PORT,
  type BudgetMonthReadPort,
} from '@modules/budget/domain/ports/budget-month-read.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { renderMonth } from './month-report';

const inputSchema = {
  // Same bounds as a budget itself, so an impossible period is refused before
  // it reaches the database.
  month: budgetSchema.shape.month.describe('Mois visé, 1 pour janvier'),
  year: budgetSchema.shape.year.describe('Année visée'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class GetMonthTool implements McpTool<Args> {
  readonly name = 'get_month';
  readonly title = 'Budget d’un mois donné';
  readonly description =
    'Rend le budget d’un mois précis : prévisions, mouvements réels et totaux (revenus, dépenses, épargne, disponible). Les montants sont dans la devise de l’utilisateur.';
  readonly mode = 'read' as const;
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(BUDGET_MONTH_READ_PORT)
    private readonly budgets: BudgetMonthReadPort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const details = await this.budgets.readMonth(args.month, args.year);
    if (!details) {
      return { text: `Aucun budget pour ${args.month}/${args.year}.` };
    }
    return { text: renderMonth(details) };
  }
}
