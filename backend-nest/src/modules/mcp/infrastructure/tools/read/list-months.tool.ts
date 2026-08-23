import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  BUDGET_MONTH_READ_PORT,
  type BudgetMonthReadPort,
} from '@modules/budget/domain/ports/budget-month-read.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { round } from './month-report';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 60;

const inputSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(
      `Nombre de mois rendus, du plus récent au plus ancien. Défaut ${DEFAULT_LIMIT}`,
    ),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class ListMonthsTool implements McpTool<Args> {
  readonly name = 'list_months';
  readonly title = 'Mois budgétés';
  readonly description =
    'Liste les mois budgétés du plus récent au plus ancien, avec leurs totaux (revenus, dépenses, épargne, report, disponible). Sert à situer un mois avant de le lire en détail.';
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
    const months = await this.budgets.listMonths(args.limit ?? DEFAULT_LIMIT);
    if (months.length === 0) {
      return { text: 'Aucun mois budgété.' };
    }
    return {
      text: [
        `Mois budgétés (${months.length})`,
        ...months.map(
          (m) =>
            `- ${m.month}/${m.year} [${m.id}] · Revenus ${round(m.totalIncome)} · Dépenses ${round(m.totalExpenses)} · Épargne prévue ${round(m.totalSavings)} · Report ${round(m.rollover)} · Disponible à dépenser ${round(m.remaining)}`,
        ),
      ].join('\n'),
    };
  }
}
