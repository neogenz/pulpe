import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { supportedCurrencySchema, transactionKindSchema } from 'pulpe-shared';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  TRANSACTION_CREATE_PORT,
  type TransactionCreatePort,
} from '@modules/transaction/domain/ports/transaction-create.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { ResolveCurrencyUseCase } from '../../../application/resolve-currency.use-case';
import { askUser } from './elicitation';

const inputSchema = {
  budgetId: z.uuid().describe('Identifiant du budget du mois visé'),
  name: z.string().min(1).max(100).describe('Intitulé du mouvement'),
  amount: z
    .number()
    .positive()
    .describe('Montant tel que l’utilisateur l’a dit'),
  kind: transactionKindSchema.describe(
    'income = revenu, expense = dépense, saving = épargne',
  ),
  currency: supportedCurrencySchema
    .optional()
    .describe(
      'Devise du montant, seulement si l’utilisateur en nomme une. Défaut : celle de ses réglages',
    ),
  budgetLineId: z
    .uuid()
    .optional()
    .describe('Prévision à laquelle rattacher le mouvement, si demandé'),
  transactionDate: z.iso
    .datetime({ offset: true })
    .optional()
    .describe('Date du mouvement, ISO 8601 avec fuseau. Défaut : maintenant'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class AddMovementTool implements McpTool<Args> {
  readonly name = 'add_movement';
  readonly title = 'Ajouter un mouvement';
  readonly description =
    'Ajoute un mouvement réel (dépense, revenu ou épargne) dans le budget d’un mois, éventuellement rattaché à une prévision.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(TRANSACTION_CREATE_PORT)
    private readonly createTransaction: TransactionCreatePort,
    private readonly resolveCurrency: ResolveCurrencyUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    // An épargne that lands nowhere is money the user cannot follow: which
    // prévision it feeds is a decision, not a default.
    if (args.kind === 'saving' && !args.budgetLineId) {
      return askUser(
        'à quelle prévision Épargne rattacher ce montant. Les prévisions du mois sont dans get_current_month ou get_month ; rappelle ensuite add_movement avec budgetLineId.',
      );
    }

    const { currency, ...rest } = args;
    const money = await this.resolveCurrency.execute(args.amount, currency);
    const created = await this.createTransaction.execute(
      { ...rest, ...money },
      this.session.user,
    );
    const converted =
      money.originalCurrency == null
        ? ''
        : ` (${money.originalAmount} ${money.originalCurrency} au taux ${money.exchangeRate})`;
    return {
      text: `Mouvement ajouté (id ${created.id}) : ${created.name}, ${created.amount}${converted}.`,
    };
  }
}
