import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { budgetSchema } from 'pulpe-shared';
import {
  BUDGET_WRITE_PORT,
  type BudgetWritePort,
} from '@modules/budget/domain/ports/budget-write.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { askUser } from './elicitation';

const inputSchema = {
  month: budgetSchema.shape.month.describe('Mois à supprimer, 1 pour janvier'),
  year: budgetSchema.shape.year.describe('Année du mois à supprimer'),
  confirmLinks: z
    .boolean()
    .optional()
    .describe(
      'true seulement après que l’utilisateur a accepté de supprimer aussi les liens avec d’autres mois ou un objectif d’épargne',
    ),
};

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

@Injectable()
export class DeleteMonthTool implements McpTool<Args> {
  readonly name = 'delete_month';
  readonly title = 'Supprimer le budget d’un mois';
  readonly description =
    'Supprime définitivement le budget d’un mois à venir, avec ses prévisions et ses mouvements. Le mois en cours et les mois passés ne peuvent pas être supprimés. À n’appeler qu’après confirmation explicite de l’utilisateur.';
  readonly mode = 'read_write' as const;
  readonly annotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false as const,
  };
  readonly inputSchema = inputSchema;

  constructor(
    @Inject(BUDGET_WRITE_PORT)
    private readonly budgets: BudgetWritePort,
  ) {}

  async execute({ month, year, confirmLinks }: Args): Promise<McpToolResult> {
    const impact = await this.budgets.deletionImpact(month, year);

    // Deleting a linked month breaks a spread, a savings goal or a withdrawal
    // pair for the months that stay. Only the user can accept that.
    const counts: [label: string, count: number][] = [
      ['prévision lissée', impact.links.spreadForecasts],
      ['objectif d’épargne', impact.links.savingsGoalForecasts],
      [
        'retrait d’épargne',
        impact.links.savingsWithdrawalForecasts +
          impact.links.savingsWithdrawalMovements,
      ],
    ];
    const links = counts.filter(([, count]) => count > 0);

    if (links.length > 0 && confirmLinks !== true) {
      const listed = links.map(([label, count]) => `${label} (${count})`);
      return askUser(
        `s’il confirme la suppression du mois ${month}/${year} et de ses liens : ${listed.join(', ')}. Les autres mois gardent leur part. Rien n’est supprimé pour l’instant. Attends sa réponse, puis rappelle delete_month avec confirmLinks: true s’il accepte.`,
      );
    }

    const removed = await this.budgets.removeMonth(
      month,
      year,
      confirmLinks === true,
    );
    return {
      text: `Budget de ${month}/${year} supprimé (prévisions : ${removed.forecastCount}, mouvements : ${removed.movementCount}).`,
    };
  }
}
