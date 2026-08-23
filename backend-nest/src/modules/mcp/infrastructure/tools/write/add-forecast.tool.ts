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
  budgetId: z.uuid().describe('Identifiant du budget du mois visé'),
  name: z.string().min(1).max(100).describe('Intitulé de la prévision'),
  amount: z
    .number()
    .positive()
    .describe('Montant tel que l’utilisateur l’a dit'),
  kind: transactionKindSchema.describe(
    'income = revenu, expense = dépense, saving = épargne',
  ),
  recurrence: transactionRecurrenceSchema
    .optional()
    .describe('fixed = Récurrent, one_off = Prévu. À demander si non dit'),
  currency: supportedCurrencySchema
    .optional()
    .describe(
      'Devise du montant, seulement si l’utilisateur en nomme une. Défaut : celle de ses réglages',
    ),
  savingsGoalId: z
    .uuid()
    .optional()
    .describe('Objectif d’épargne alimenté par cette prévision, si demandé'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class AddForecastTool implements McpTool<Args> {
  readonly name = 'add_forecast';
  readonly title = 'Ajouter une prévision';
  readonly description =
    'Ajoute une prévision dans le budget d’un mois : une somme attendue, récurrente ou ponctuelle, à laquelle les mouvements réels viendront se rattacher.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(BUDGET_LINE_WRITE_PORT)
    private readonly forecasts: BudgetLineWritePort,
    private readonly resolveCurrency: ResolveCurrencyUseCase,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    // Récurrent or Prévu changes what the month looks like every month after
    // this one. Guessing it would quietly rewrite the user's plan.
    if (!args.recurrence) {
      return askUser(
        'si cette prévision revient chaque mois (Récurrent) ou concerne ce mois seulement (Prévu), puis rappelle add_forecast avec recurrence.',
      );
    }

    const { currency, recurrence, ...rest } = args;
    const money = await this.resolveCurrency.execute(args.amount, currency);
    const created = await this.forecasts.create({
      ...rest,
      ...money,
      recurrence,
      isManuallyAdjusted: false,
    });
    return {
      text: `Prévision ajoutée (id ${created.id}) : ${created.name}, ${created.amount}, ${recurrence === 'fixed' ? 'Récurrent' : 'Prévu'}.`,
    };
  }
}
