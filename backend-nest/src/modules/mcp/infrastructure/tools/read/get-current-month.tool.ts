import { Inject, Injectable } from '@nestjs/common';
import { getBudgetPeriodForDate } from 'pulpe-shared';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  BUDGET_MONTH_READ_PORT,
  type BudgetMonthReadPort,
} from '@modules/budget/domain/ports/budget-month-read.port';
import type { McpTool, McpToolResult } from '../../../domain/mcp-tool.entity';
import { renderMonth } from './month-report';

@Injectable()
export class GetCurrentMonthTool implements McpTool {
  readonly name = 'get_current_month';
  readonly title = 'Budget du mois en cours';
  readonly description =
    'Rend le budget du mois en cours : prévisions, mouvements réels et totaux (revenus, dépenses, épargne, disponible). Les montants sont dans la devise de l’utilisateur.';
  readonly mode = 'read' as const;
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false as const,
  };
  readonly inputSchema = {};

  constructor(
    @Inject(BUDGET_MONTH_READ_PORT)
    private readonly budgets: BudgetMonthReadPort,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  async execute(): Promise<McpToolResult> {
    const { month, year } = getBudgetPeriodForDate(
      new Date(),
      this.session.user.payDayOfMonth,
    );
    const details = await this.budgets.readMonth(month, year);
    if (!details) {
      return { text: `Aucun budget pour ${month}/${year}.` };
    }
    return { text: renderMonth(details) };
  }
}
