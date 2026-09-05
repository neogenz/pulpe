import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  BUDGET_LINE_WRITE_PORT,
  type BudgetLineWritePort,
} from '@modules/budget-line/domain/ports/budget-line-write.port';
import {
  TRANSACTION_WRITE_PORT,
  type TransactionWritePort,
} from '@modules/transaction/domain/ports/transaction-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';

const inputSchema = {
  id: z.uuid().describe('Identifiant du mouvement ou de la prévision'),
  target: z
    .enum(['movement', 'forecast'])
    .describe('movement = un mouvement réel, forecast = une prévision'),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class ToggleCheckTool implements McpTool<Args> {
  readonly name = 'toggle_check';
  readonly title = 'Pointer ou dépointer';
  readonly description =
    'Bascule l’état pointé d’un mouvement ou d’une prévision : ce qui était « À pointer » devient « Pointé », et inversement.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: true,
    // A toggle: calling it twice returns to the starting state, never idempotent.
    idempotentHint: false,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(TRANSACTION_WRITE_PORT)
    private readonly movements: TransactionWritePort,
    @Inject(BUDGET_LINE_WRITE_PORT)
    private readonly forecasts: BudgetLineWritePort,
  ) {}

  async execute(args: Args): Promise<McpToolResult> {
    const entity =
      args.target === 'movement'
        ? await this.movements.toggleCheck(args.id)
        : await this.forecasts.toggleCheck(args.id);
    const label = args.target === 'movement' ? 'Mouvement' : 'Prévision';
    return {
      text: `${label} « ${entity.name} » : ${entity.checkedAt ? 'Pointé' : 'À pointer'}.`,
    };
  }
}
