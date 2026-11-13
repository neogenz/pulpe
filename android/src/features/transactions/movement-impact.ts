import {
  BudgetFormulas,
  type BudgetLine,
  type SupportedCurrency,
  type Transaction,
  type TransactionKind,
} from "pulpe-shared";

import {
  type ImpactBlockContent,
  impactBlockFor,
  impactTitle,
} from "@/features/budget-details/components/impact-confirm-sheet";
import { formatAmount } from "@/core/ui/amount-format";
import {
  type DisponibleImpact,
  impactBetween,
} from "@/features/budget-details/month-impact";

export interface MovementImpact extends DisponibleImpact {
  /** What is left on the chosen prévision, before and after; null without one. */
  lineBefore: number | null;
  lineAfter: number | null;
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
  // Only what the formulas read of the draft: it has no id nor date yet.
  const drafted = [
    ...transactions.filter((tx) => tx.id !== input.replacingId),
    { kind: draft.kind, amount: draft.amount, budgetLineId: draft.lineId },
  ] as Transaction[];
  const line = lines.find((candidate) => candidate.id === draft.lineId);

  return {
    ...impactBetween(
      { lines: lineList, transactions, rollover },
      { lines: lineList, transactions: drafted, rollover },
    ),
    lineBefore:
      line === undefined
        ? null
        : BudgetFormulas.calculateConsumption(line, transactions).available,
    lineAfter:
      line === undefined
        ? null
        : BudgetFormulas.calculateConsumption(line, drafted).available,
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

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** What the movement sheet's impact block says: the shared block's content. */
export function movementImpactContent(
  t: Translate,
  impact: MovementImpact,
  line: BudgetLine | undefined,
  currency: SupportedCurrency,
): ImpactBlockContent {
  const note = impactNote(impact, line);
  return impactBlockFor(
    impact,
    impactTitle(t, impact, currency),
    note === null
      ? undefined
      : t(`budgets.mutations.activity.impact.note.${note.kind}`, {
          name: "lineName" in note ? note.lineName : "",
          before: "before" in note ? formatAmount(note.before, currency) : "",
          after: "after" in note ? formatAmount(note.after, currency) : "",
        }),
  );
}
