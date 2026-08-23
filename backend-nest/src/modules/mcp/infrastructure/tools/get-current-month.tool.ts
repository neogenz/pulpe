import { Inject, Injectable } from '@nestjs/common';
import { BudgetFormulas, getBudgetPeriodForDate } from 'pulpe-shared';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  BUDGET_MONTH_READ_PORT,
  type BudgetMonthReadPort,
} from '@modules/budget/domain/ports/budget-month-read.port';
import type { McpTool, McpToolResult } from '../../domain/mcp-tool.entity';

const KIND_LABEL = { income: 'Revenu', expense: 'Dépense', saving: 'Épargne' };

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

    const { budget, budgetLines, transactions, rollover } = details;
    const m = BudgetFormulas.calculateAllMetrics(
      budgetLines,
      transactions,
      rollover,
    );
    // Same rounding as the app's display: no float noise for the model.
    const r = (n: number) => Number(n.toFixed(2));
    const lines = budgetLines.map(
      (l) =>
        `- [${l.id}] ${KIND_LABEL[l.kind]} · ${l.name} · ${l.amount} · ${l.recurrence === 'fixed' ? 'Récurrent' : 'Prévu'}${l.checkedAt ? ' · Pointé' : ''}`,
    );
    const moves = transactions.map(
      (t) =>
        `- [${t.id}] ${KIND_LABEL[t.kind]} · ${t.name} · ${t.amount} · ${t.transactionDate.slice(0, 10)}${t.checkedAt ? ' · Pointé' : ''}`,
    );

    return {
      text: [
        `Budget ${budget.month}/${budget.year} (id ${budget.id})`,
        `Revenus ${r(m.totalIncome)} · Dépenses ${r(m.totalExpenses)} · Épargne prévue ${r(m.totalSavings)} · Report ${r(m.rollover)} · Disponible à dépenser ${r(m.remaining)}`,
        '',
        `Prévisions (${budgetLines.length})`,
        ...lines,
        '',
        `Mouvements (${transactions.length})`,
        ...moves,
      ].join('\n'),
    };
  }
}
