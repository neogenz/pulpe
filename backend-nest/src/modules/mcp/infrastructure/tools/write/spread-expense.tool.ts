import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { budgetLineSpreadFromLineCreateSchema } from 'pulpe-shared';
import {
  BUDGET_LINE_WRITE_PORT,
  type BudgetLineWritePort,
} from '@modules/budget-line/domain/ports/budget-line-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';

const inputSchema = {
  forecastId: z.uuid().describe('Identifiant de la prévision à lisser'),
  // Same rule as `POST /budget-lines/:id/spread`: two months at least, each once.
  months: budgetLineSpreadFromLineCreateSchema.shape.periods.describe(
    'Mois sur lesquels étaler la dépense, deux au minimum, chacun une seule fois. Les mois sans budget sont créés depuis le modèle par défaut',
  ),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class SpreadExpenseTool implements McpTool<Args> {
  readonly name = 'spread_expense';
  readonly title = 'Lisser une dépense sur plusieurs mois';
  readonly description =
    'Étale une prévision existante sur plusieurs mois : le montant est réparti en tranches, une par mois, au lieu de peser sur un seul.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(BUDGET_LINE_WRITE_PORT)
    private readonly forecasts: BudgetLineWritePort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const result = await this.forecasts.spread(args.forecastId, args.months);
    const skipped = result.skippedMonths.length
      ? ` Mois laissés de côté faute de modèle : ${result.skippedMonths.map((p) => `${p.month}/${p.year}`).join(', ')}.`
      : '';
    return {
      text: `Dépense lissée sur ${result.lines.length} mois.${skipped}\n${result.lines
        .map((l) => `- [${l.id}] ${l.name} · ${l.amount}`)
        .join('\n')}`,
    };
  }
}
