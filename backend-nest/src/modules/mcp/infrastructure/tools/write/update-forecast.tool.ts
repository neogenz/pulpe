import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  supportedCurrencySchema,
  transactionKindSchema,
  transactionRecurrenceSchema,
} from 'pulpe-shared';
import {
  BUDGET_LINE_WRITE_PORT,
  type BudgetLineWritePort,
} from '@modules/budget-line/domain/ports/budget-line-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { ResolveCurrencyUseCase } from '../../../application/resolve-currency.use-case';
import { askUser } from './elicitation';

const inputSchema = {
  forecastId: z.uuid().describe('Identifiant de la prévision à modifier'),
  name: z.string().min(1).max(100).optional().describe('Nouvel intitulé'),
  amount: z
    .number()
    .positive()
    .optional()
    .describe('Nouveau montant tel que l’utilisateur l’a dit'),
  kind: transactionKindSchema.optional().describe('Nouvelle nature'),
  recurrence: transactionRecurrenceSchema
    .optional()
    .describe('fixed = Mensuel, one_off = Ponctuel'),
  currency: supportedCurrencySchema
    .optional()
    .describe(
      'Devise du nouveau montant, seulement si l’utilisateur en nomme une',
    ),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class UpdateForecastTool implements McpTool<Args> {
  readonly name = 'update_forecast';
  readonly title = 'Modifier une prévision';
  readonly description =
    'Modifie une prévision existante : intitulé, montant, nature ou fréquence. Seuls les champs fournis changent. La prévision est alors marquée ajustée à la main : une modification du modèle ne la changera plus. Pour plusieurs mois : adjust_over_months ; pour le modèle : edit_template_lines.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(BUDGET_LINE_WRITE_PORT)
    private readonly forecasts: BudgetLineWritePort,
    private readonly resolveCurrency: ResolveCurrencyUseCase,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const { forecastId, currency, amount, ...rest } = args;
    if (currency !== undefined && amount === undefined) {
      return askUser(
        'le montant dans cette devise : une devise seule ne change rien. Rappelle update_forecast avec amount et currency.',
      );
    }
    // Written over `rest`, not a field list: a field added later counts as a change.
    if (
      amount === undefined &&
      Object.values(rest).every((v) => v === undefined)
    ) {
      return askUser(
        'ce qu’il faut modifier sur cette prévision (intitulé, montant, nature ou fréquence), puis rappelle update_forecast.',
      );
    }
    const money =
      amount == null
        ? {}
        : await this.resolveCurrency.execute(amount, currency);
    const updated = await this.forecasts.update(forecastId, {
      id: forecastId,
      ...rest,
      ...money,
    });
    return {
      text: `Prévision modifiée (id ${updated.id}) : ${updated.name}, ${updated.amount}.`,
    };
  }
}
