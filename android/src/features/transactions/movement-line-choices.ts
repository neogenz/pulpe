import {
  BudgetFormulas,
  type BudgetLine,
  type Transaction,
  type TransactionKind,
} from "pulpe-shared";

import { foldedForSearch } from "@/features/tags/tag-selection";

/** The picker's sections: room left, already past the forecast, everything else. */
export interface LineSections {
  margin: BudgetLine[];
  over: BudgetLine[];
  others: BudgetLine[];
  /** What each sorted line has left, keyed by line id. */
  available: ReadonlyMap<string, number>;
}

/** One pass over the month's movements, so each line only reads its own. */
function movementsByLine(
  transactions: readonly Transaction[],
): Map<string, Transaction[]> {
  const byLine = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.budgetLineId === null) continue;
    const own = byLine.get(tx.budgetLineId);
    if (own === undefined) byLine.set(tx.budgetLineId, [tx]);
    else own.push(tx);
  }
  return byLine;
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

  const byLine = movementsByLine(transactions);
  let best: BudgetLine | null = null;
  let bestLeft = 0;
  for (const line of candidates) {
    if (line.checkedAt !== null) continue;
    const { available } = BudgetFormulas.calculateConsumption(
      line,
      byLine.get(line.id) ?? [],
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
  const byLine = movementsByLine(transactions);
  const available = new Map<string, number>();
  const sections: LineSections = {
    margin: [],
    over: [],
    others: [],
    available,
  };
  for (const line of eligibleLines(lines, kind)) {
    const left = BudgetFormulas.calculateConsumption(
      line,
      byLine.get(line.id) ?? [],
    ).available;
    available.set(line.id, left);
    if (left < 0) sections.over.push(line);
    else if (line.checkedAt === null && left > 0) sections.margin.push(line);
    else sections.others.push(line);
  }
  return sections;
}

/**
 * The search above the picker: keeps the lines whose name holds the query,
 * ignoring case and accents, like `localizedStandardContains` on iOS.
 */
export function matchingSections(
  sections: LineSections,
  query: string,
): LineSections {
  const needle = foldedForSearch(query.trim());
  if (needle === "") return sections;
  const keep = (lines: BudgetLine[]) =>
    lines.filter((line) => foldedForSearch(line.name).includes(needle));
  return {
    margin: keep(sections.margin),
    over: keep(sections.over),
    others: keep(sections.others),
    available: sections.available,
  };
}
