import {
  BudgetFormulas,
  moneyDifference,
  type BudgetLine,
  type Transaction,
  type TransactionKind,
} from "pulpe-shared";

export type ImpactTone = "neutral" | "over" | "ok";

export interface MovementImpact {
  before: number;
  after: number;
  /** What is left on the chosen prévision, before and after; null without one. */
  lineBefore: number | null;
  lineAfter: number | null;
  /** How far the disponible moves: negative lowers it. */
  delta: number;
  tone: ImpactTone;
}

export interface MovementDraft {
  kind: TransactionKind;
  amount: number;
  /** Null is a movement no prévision covers. */
  lineId: string | null;
}

/**
 * What a movement does to the disponible, judged by the formula the budget
 * uses: the metrics before and after the draft joins the ledger. `replacingId`
 * is the movement being edited, which leaves the "after" ledger for the draft
 * to take its place. Port of `MovementImpact.compute` on iOS.
 */
export function computeMovementImpact(input: {
  lines: readonly BudgetLine[];
  transactions: readonly Transaction[];
  rollover: number;
  replacingId?: string;
  draft: MovementDraft;
}): MovementImpact {
  const { lines, rollover, draft } = input;
  const transactions = input.transactions as Transaction[];
  const lineList = lines as BudgetLine[];
  const drafted = [
    ...transactions.filter((tx) => tx.id !== input.replacingId),
    { kind: draft.kind, amount: draft.amount, budgetLineId: draft.lineId },
  ];

  const before = BudgetFormulas.calculateAllMetrics(
    lineList,
    transactions,
    rollover,
  ).remaining;
  const after = BudgetFormulas.calculateAllMetrics(
    lineList,
    drafted,
    rollover,
  ).remaining;
  const line = lines.find((candidate) => candidate.id === draft.lineId);
  const delta = moneyDifference(after, before);

  return {
    before,
    after,
    lineBefore:
      line === undefined
        ? null
        : BudgetFormulas.calculateConsumption(line, transactions).available,
    lineAfter:
      line === undefined
        ? null
        : BudgetFormulas.calculateConsumption(line, drafted).available,
    delta,
    tone: delta === 0 ? "neutral" : delta < 0 ? "over" : "ok",
  };
}

/** The note under the figures, as data: the sheet owns the words. */
export type ImpactNote =
  | { kind: "covered"; lineName: string; before: number; after: number }
  | { kind: "overLine"; lineName: string }
  | { kind: "uncovered" };

export function impactNote(
  impact: MovementImpact,
  line: BudgetLine | undefined,
): ImpactNote | null {
  if (
    line !== undefined &&
    impact.lineBefore !== null &&
    impact.lineAfter !== null
  ) {
    if (impact.tone === "neutral") {
      return {
        kind: "covered",
        lineName: line.name,
        before: Math.max(impact.lineBefore, 0),
        after: Math.max(impact.lineAfter, 0),
      };
    }
    return impact.tone === "over"
      ? { kind: "overLine", lineName: line.name }
      : null;
  }
  return impact.tone === "over" ? { kind: "uncovered" } : null;
}
