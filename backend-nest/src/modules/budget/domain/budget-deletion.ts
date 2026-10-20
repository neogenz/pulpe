import type { BudgetDeletionImpact } from 'pulpe-shared';

/** Link columns of one month, as read from `budget_line` and `transaction`. */
export interface BudgetDeletionLinkRows {
  lines: {
    spreadGroupId: string | null;
    savingsGoalId: string | null;
    savingsWithdrawalGroupId: string | null;
    sourceSavingsGoalId: string | null;
  }[];
  movements: { sourceSavingsGoalId: string | null }[];
}

export function summarizeDeletionImpact(
  rows: BudgetDeletionLinkRows,
): BudgetDeletionImpact {
  const links = {
    spreadForecasts: 0,
    savingsGoalForecasts: 0,
    savingsWithdrawalForecasts: 0,
    savingsWithdrawalMovements: rows.movements.filter(
      (movement) => movement.sourceSavingsGoalId !== null,
    ).length,
  };

  for (const line of rows.lines) {
    // ponytail: first match wins, so a forecast counts once. Goal-generated
    // lines carry spread_group_id = the goal id, so they count as goal; a
    // spread the user aimed at a goal carries its own group id, so spread.
    if (line.savingsWithdrawalGroupId || line.sourceSavingsGoalId) {
      links.savingsWithdrawalForecasts++;
    } else if (
      line.spreadGroupId &&
      line.spreadGroupId !== line.savingsGoalId
    ) {
      links.spreadForecasts++;
    } else if (line.savingsGoalId) {
      links.savingsGoalForecasts++;
    }
  }

  return {
    forecastCount: rows.lines.length,
    movementCount: rows.movements.length,
    links,
  };
}

export function hasDeletionLinks(impact: BudgetDeletionImpact): boolean {
  return Object.values(impact.links).some((count) => count > 0);
}
