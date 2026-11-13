import {
  BudgetFormulas,
  type BudgetLine,
  type SupportedCurrency,
} from "pulpe-shared";

import {
  impactBetween,
  type DisponibleImpact,
  type MonthLedger,
  replacingAmount,
} from "./month-impact";

const CENTIMES_PER_UNIT = 100;

const cents = (value: number) => Math.round(value * CENTIMES_PER_UNIT);

export interface Overrun {
  line: BudgetLine;
  amount: number;
}

export interface CatchUpChoice {
  line: BudgetLine;
  remaining: number;
  /** The prévision once it takes back what it can. */
  newAmount: number;
  /** `false`: the margin covers only part of the overrun. */
  coversAll: boolean;
}

export interface CatchUpPlan {
  overruns: Overrun[];
  /** Most margin first. */
  choices: CatchUpChoice[];
  total: number;
}

/**
 * « Rattraper » (`CatchUpPlan.swift`): what overruns this month, and which
 * dépense still has margin to take it back. `focusLineId`: opened from one
 * prévision, only its overrun is taken back. A line typed in another currency
 * is left out (re-planning it needs a conversion), and so is an untouched
 * prévision the overrun would empty: the API refuses an amount of zero.
 */
export function catchUpPlan(
  ledger: MonthLedger,
  focusLineId: string | null,
  userCurrency: SupportedCurrency,
): CatchUpPlan {
  const expenses = ledger.lines.filter(
    (line) =>
      line.kind === "expense" &&
      line.isRollover !== true &&
      line.savingsGoalId === null,
  );
  const reste = new Map(
    expenses.map((line) => [
      line.id,
      BudgetFormulas.calculateConsumption(line, ledger.transactions).available,
    ]),
  );
  const left = (line: BudgetLine) => reste.get(line.id) ?? 0;

  const overruns = expenses
    .filter(
      (line) =>
        cents(left(line)) < 0 &&
        (focusLineId === null || line.id === focusLineId),
    )
    .map((line) => ({ line, amount: -left(line) }));
  const total = overruns.reduce((sum, { amount }) => sum + amount, 0);
  if (cents(total) <= 0) return { overruns: [], choices: [], total: 0 };

  // A pointed prévision counts as fully spent: no margin left on it.
  const choices = expenses
    .filter((line) => line.checkedAt === null && cents(left(line)) > 0)
    .filter(
      (line) =>
        line.originalCurrency == null || line.originalCurrency === userCurrency,
    )
    .map((line) => ({
      line,
      remaining: left(line),
      newAmount: line.amount - Math.min(total, left(line)),
      coversAll: cents(left(line)) >= cents(total),
    }))
    .filter((choice) => cents(choice.newAmount) > 0)
    .sort((a, b) => b.remaining - a.remaining);

  return { overruns, choices, total };
}

/** The choice that covers it all, else the one with the most margin. */
export function defaultChoice(plan: CatchUpPlan): CatchUpChoice | undefined {
  return plan.choices.find((choice) => choice.coversAll) ?? plan.choices[0];
}

/** The overrun prévisions raised by what `choice` takes back, in order. */
export function raisesFor(
  plan: CatchUpPlan,
  choice: CatchUpChoice,
): { line: BudgetLine; newAmount: number }[] {
  let left = choice.line.amount - choice.newAmount;
  return plan.overruns.flatMap(({ line, amount }) => {
    const share = Math.min(amount, left);
    if (cents(share) <= 0) return [];
    left -= share;
    return [{ line, newAmount: line.amount + share }];
  });
}

/** The amounts to write, the lowered prévision first so a failed raise leaves the disponible right. */
export function updatesFor(
  plan: CatchUpPlan,
  choice: CatchUpChoice,
): { id: string; amount: number }[] {
  return [
    { id: choice.line.id, amount: choice.newAmount },
    ...raisesFor(plan, choice).map(({ line, newAmount }) => ({
      id: line.id,
      amount: newAmount,
    })),
  ];
}

export function catchUpImpact(
  plan: CatchUpPlan,
  choice: CatchUpChoice,
  ledger: MonthLedger,
): DisponibleImpact {
  const after = updatesFor(plan, choice).reduce(
    (month, { id, amount }) => replacingAmount(month, id, amount),
    ledger,
  );
  return impactBetween(ledger, after);
}
