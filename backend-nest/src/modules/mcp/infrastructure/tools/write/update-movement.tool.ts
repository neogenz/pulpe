import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { supportedCurrencySchema, transactionKindSchema } from 'pulpe-shared';
import {
  TRANSACTION_WRITE_PORT,
  type TransactionWritePort,
} from '@modules/transaction/domain/ports/transaction-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { ResolveCurrencyUseCase } from '../../../application/resolve-currency.use-case';

const inputSchema = {
  movementId: z.uuid().describe('Identifiant du mouvement à modifier'),
  name: z.string().min(1).max(100).optional().describe('Nouvel intitulé'),
  amount: z
    .number()
    .positive()
    .optional()
    .describe('Nouveau montant tel que l’utilisateur l’a dit'),
  kind: transactionKindSchema.optional().describe('Nouvelle nature'),
  currency: supportedCurrencySchema
    .optional()
    .describe(
      'Devise du nouveau montant, seulement si l’utilisateur en nomme une',
    ),
  transactionDate: z.iso
    .datetime({ offset: true })
    .optional()
    .describe('Nouvelle date, ISO 8601 avec fuseau'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class UpdateMovementTool implements McpTool<Args> {
  readonly name = 'update_movement';
  readonly title = 'Modifier un mouvement';
  readonly description =
    'Modifie un mouvement réel existant : intitulé, montant, nature ou date. Seuls les champs fournis changent.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(TRANSACTION_WRITE_PORT)
    private readonly movements: TransactionWritePort,
    private readonly resolveCurrency: ResolveCurrencyUseCase,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const { movementId, currency, amount, ...rest } = args;
    const money =
      amount == null
        ? {}
        : await this.resolveCurrency.execute(amount, currency);
    const updated = await this.movements.update(movementId, {
      ...rest,
      ...money,
    });
    return {
      text: `Mouvement modifié (id ${updated.id}) : ${updated.name}, ${updated.amount}.`,
    };
  }
}
