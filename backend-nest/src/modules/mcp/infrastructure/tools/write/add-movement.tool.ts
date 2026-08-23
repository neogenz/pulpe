import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { transactionKindSchema } from 'pulpe-shared';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  TRANSACTION_CREATE_PORT,
  type TransactionCreatePort,
} from '@modules/transaction/domain/ports/transaction-create.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';

const inputSchema = {
  budgetId: z.uuid().describe('Identifiant du budget du mois visé'),
  name: z.string().min(1).max(100).describe('Intitulé du mouvement'),
  amount: z.number().positive().describe('Montant, dans la devise du budget'),
  kind: transactionKindSchema.describe(
    'income = revenu, expense = dépense, saving = épargne',
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
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const created = await this.createTransaction.execute(
      args,
      this.session.user,
    );
    return {
      text: `Mouvement ajouté (id ${created.id}) : ${created.name}, ${created.amount}.`,
    };
  }
}
