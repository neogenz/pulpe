import {
  BudgetFormulas,
  type BudgetLine,
  type Transaction,
  type TransactionKind,
} from "pulpe-shared";

/** The picker's sections: room left, already past the forecast, everything else. */
export interface LineSections {
  margin: BudgetLine[];
  over: BudgetLine[];
  others: BudgetLine[];
}

/**
 * The prévisions a movement can be filed under. The backend refuses another
 * kind, a rollover line and an announced withdrawal whose goal is gone, so none
 * of them is ever offered. Port of `MovementLineChoices` on iOS.
 */
export function eligibleLines(
  lines: readonly BudgetLine[],
  kind: TransactionKind,
): BudgetLine[] {
  return lines.filter(
    (line) =>
      line.kind === kind &&
      line.isRollover !== true &&
      !(
        (line.sourceSavingsGoalId ?? null) === null &&
        (line.sourceSavingsGoalName ?? null) !== null
      ),
  );
}

/**
 * No model says which line is the likely one, so: the line of a same-name
 * movement this month, else the unpointed line with the most left.
 */
export function suggestedLine(input: {
  lines: readonly BudgetLine[];
  transactions: readonly Transaction[];
  kind: TransactionKind;
  name: string;
}): BudgetLine | null {
  const { lines, transactions, kind } = input;
  const candidates = eligibleLines(lines, kind);
  const typed = input.name.trim().toLowerCase();
  if (typed !== "") {
    const lineId = transactions.find(
      (tx) => tx.kind === kind && tx.name.toLowerCase() === typed,
    )?.budgetLineId;
    const match = candidates.find((line) => line.id === lineId);
    if (match !== undefined) return match;
  }

  let best: BudgetLine | null = null;
  let bestLeft = 0;
  for (const line of candidates) {
    if (line.checkedAt !== null) continue;
    const { available } = BudgetFormulas.calculateConsumption(
      line,
      transactions as Transaction[],
    );
    if (available > bestLeft) {
      best = line;
      bestLeft = available;
    }
  }
  return best;
}

export function lineSections(
  lines: readonly BudgetLine[],
  transactions: readonly Transaction[],
  kind: TransactionKind,
): LineSections {
  const sections: LineSections = { margin: [], over: [], others: [] };
  for (const line of eligibleLines(lines, kind)) {
    const { available } = BudgetFormulas.calculateConsumption(
      line,
      transactions as Transaction[],
    );
    if (available < 0) sections.over.push(line);
    else if (line.checkedAt === null && available > 0)
      sections.margin.push(line);
    else sections.others.push(line);
  }
  return sections;
}
