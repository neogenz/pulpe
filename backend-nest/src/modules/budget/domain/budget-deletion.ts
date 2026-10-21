import type { BudgetDeletionImpact } from 'pulpe-shared';

/** Link columns of one month, as read from `budget_line` and `transaction`. */
export interface BudgetDeletionLinkRows {
  lines: {
    id: string;
    spreadGroupId: string | null;
    savingsGoalId: string | null;
    savingsWithdrawalGroupId: string | null;
    sourceSavingsGoalId: string | null;
  }[];
  movements: {
    budgetLineId: string | null;
    sourceSavingsGoalId: string | null;
  }[];
}

export function summarizeDeletionImpact(
  rows: BudgetDeletionLinkRows,
): BudgetDeletionImpact {
  const links = {
    spreadForecasts: 0,
    savingsGoalForecasts: 0,
    savingsWithdrawalForecasts: 0,
    savingsWithdrawalMovements: 0,
  };
  const withdrawalForecastIds = new Set<string | null>();

  for (const line of rows.lines) {
    // ponytail: first match wins, so a forecast counts once. Goal-generated
    // lines carry spread_group_id = the goal id, so they count as goal; a
    // spread the user aimed at a goal carries its own group id, so spread.
    if (line.savingsWithdrawalGroupId || line.sourceSavingsGoalId) {
      links.savingsWithdrawalForecasts++;
      withdrawalForecastIds.add(line.id);
    } else if (
      line.spreadGroupId &&
      line.spreadGroupId !== line.savingsGoalId
    ) {
      links.spreadForecasts++;
    } else if (line.savingsGoalId) {
      links.savingsGoalForecasts++;
    }
  }

  // A realized withdrawal is its forecast plus the movement allocated to it:
  // one withdrawal, already counted through the forecast.
  links.savingsWithdrawalMovements = rows.movements.filter(
    (movement) =>
      movement.sourceSavingsGoalId !== null &&
      !withdrawalForecastIds.has(movement.budgetLineId),
  ).length;

  return {
    forecastCount: rows.lines.length,
    movementCount: rows.movements.length,
    links,
  };
}

export function hasDeletionLinks(impact: BudgetDeletionImpact): boolean {
  return Object.values(impact.links).some((count) => count > 0);
}
