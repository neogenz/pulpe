import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  budgetSchema,
  TRANSACTION_SEARCH_QUERY_MIN_LENGTH,
  TRANSACTION_SEARCH_QUERY_MAX_LENGTH,
} from 'pulpe-shared';
import {
  TRANSACTION_SEARCH_PORT,
  type TransactionSearchPort,
} from '@modules/transaction/domain/ports/transaction-search.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { KIND_LABEL, round } from './month-report';

const inputSchema = {
  query: z
    .string()
    .min(TRANSACTION_SEARCH_QUERY_MIN_LENGTH)
    .max(TRANSACTION_SEARCH_QUERY_MAX_LENGTH)
    .describe('Terme cherché dans l’intitulé, par exemple « courses »'),
  years: z
    .array(budgetSchema.shape.year)
    .optional()
    .describe('Années auxquelles limiter la recherche. Défaut : toutes'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class SearchMovementsTool implements McpTool<Args> {
  readonly name = 'search_movements';
  readonly title = 'Chercher un mouvement ou une prévision';
  readonly description =
    'Cherche par intitulé dans les mouvements réels et les prévisions de tous les mois. Rend les cinquante résultats les plus récents, avec leur mois.';
  readonly mode = 'read' as const;
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(TRANSACTION_SEARCH_PORT)
    private readonly search: TransactionSearchPort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const results = await this.search.search({
      q: args.query,
      years: args.years,
    });
    if (results.length === 0) {
      return { text: `Aucun résultat pour « ${args.query} ».` };
    }
    return {
      text: [
        `Résultats pour « ${args.query} » (${results.length})`,
        ...results.map(
          (r) =>
            `- [${r.id}] ${r.itemType === 'transaction' ? 'Mouvement' : 'Prévision'} · ${KIND_LABEL[r.kind]} · ${r.name} · ${round(r.amount)} · ${r.month}/${r.year} (budget ${r.budgetId})`,
        ),
      ].join('\n'),
    };
  }
}
