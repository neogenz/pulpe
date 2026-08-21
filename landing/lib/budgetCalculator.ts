import type { LandingCurrency } from "./amount";

export type LineKind = "expense" | "saving";

export type FixedField =
  | "income"
  | "rent"
  | "insurance"
  | "phone"
  | "internet"
  | "transport"
  | "leasing";

export interface BudgetLine {
  id: string;
  label: string;
  kind: LineKind;
  amount: number;
}

export interface BudgetInputs {
  income: number;
  rent: number;
  insurance: number;
  phone: number;
  internet: number;
  transport: number;
  leasing: number;
  addedLines: BudgetLine[];
}

export const EMPTY_BUDGET: BudgetInputs = {
  income: 0,
  rent: 0,
  insurance: 0,
  phone: 0,
  internet: 0,
  transport: 0,
  leasing: 0,
  addedLines: [],
};

export const CALCULATOR_CHIPS = [
  {
    id: "groceries",
    label: "Courses / alimentation",
    amount: 600,
    kind: "expense",
  },
  {
    id: "restaurants",
    label: "Restaurants & sorties",
    amount: 150,
    kind: "expense",
  },
  {
    id: "leisure",
    label: "Loisirs & sport",
    amount: 100,
    kind: "expense",
  },
  { id: "saving", label: "Épargne", amount: 500, kind: "saving" },
  { id: "pillar3", label: "3ème pilier", amount: 587, kind: "saving" },
] as const;

export type CalculatorChip = (typeof CALCULATOR_CHIPS)[number];

export function chipLabel(
  chip: CalculatorChip,
  currency: LandingCurrency,
): string {
  if (chip.id === "pillar3") {
    return currency === "EUR" ? "Épargne retraite" : "3ème pilier";
  }
  return chip.label;
}

export function committedExpenses(input: BudgetInputs): number {
  const fixed =
    input.rent +
    input.insurance +
    input.phone +
    input.internet +
    input.transport +
    input.leasing;
  const lines = input.addedLines.reduce((sum, line) => sum + line.amount, 0);
  return fixed + lines;
}

export function availableToSpend(input: BudgetInputs): number {
  return input.income - committedExpenses(input);
}

function clampAmount(amount: number): number {
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

export function toggleChip(
  state: BudgetInputs,
  chip: CalculatorChip,
  currency: LandingCurrency,
): BudgetInputs {
  if (state.addedLines.some((line) => line.id === chip.id)) {
    return {
      ...state,
      addedLines: state.addedLines.filter((line) => line.id !== chip.id),
    };
  }

  return {
    ...state,
    addedLines: [
      ...state.addedLines,
      {
        id: chip.id,
        label: chipLabel(chip, currency),
        kind: chip.kind,
        amount: chip.amount,
      },
    ],
  };
}

export function updateLineAmount(
  state: BudgetInputs,
  id: string,
  amount: number,
): BudgetInputs {
  return {
    ...state,
    addedLines: state.addedLines.map((line) =>
      line.id === id ? { ...line, amount: clampAmount(amount) } : line,
    ),
  };
}

export function removeLine(state: BudgetInputs, id: string): BudgetInputs {
  return {
    ...state,
    addedLines: state.addedLines.filter((line) => line.id !== id),
  };
}
