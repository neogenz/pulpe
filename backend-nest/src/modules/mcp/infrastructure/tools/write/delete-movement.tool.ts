import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  TRANSACTION_WRITE_PORT,
  type TransactionWritePort,
} from '@modules/transaction/domain/ports/transaction-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';

const inputSchema = {
  movementId: z.uuid().describe('Identifiant du mouvement à supprimer'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class DeleteMovementTool implements McpTool<Args> {
  readonly name = 'delete_movement';
  readonly title = 'Supprimer un mouvement';
  readonly description =
    'Supprime définitivement un mouvement réel. À n’appeler qu’après confirmation explicite de l’utilisateur.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(TRANSACTION_WRITE_PORT)
    private readonly movements: TransactionWritePort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    await this.movements.remove(args.movementId);
    return { text: `Mouvement supprimé (id ${args.movementId}).` };
  }
}
