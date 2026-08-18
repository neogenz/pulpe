export interface BudgetInputs {
  income: number;
  rent: number;
  insurance: number;
  phone: number;
  internet: number;
  transport: number;
  leasing: number;
  extra: number;
  savings: number;
}

export const EMPTY_BUDGET: BudgetInputs = {
  income: 0,
  rent: 0,
  insurance: 0,
  phone: 0,
  internet: 0,
  transport: 0,
  leasing: 0,
  extra: 0,
  savings: 0,
};

export const CALCULATOR_CHIPS = [
  {
    id: "groceries",
    label: "Courses / alimentation",
    amount: 600,
    field: "extra",
  },
  {
    id: "restaurants",
    label: "Restaurants & sorties",
    amount: 150,
    field: "extra",
  },
  {
    id: "leisure",
    label: "Loisirs & sport",
    amount: 100,
    field: "extra",
  },
  { id: "saving", label: "Épargne", amount: 500, field: "savings" },
  { id: "pillar3", label: "3ème pilier", amount: 587, field: "savings" },
] as const;

export function committedExpenses(input: BudgetInputs): number {
  return (
    input.rent +
    input.insurance +
    input.phone +
    input.internet +
    input.transport +
    input.leasing +
    input.extra +
    input.savings
  );
}

export function availableToSpend(input: BudgetInputs): number {
  return input.income - committedExpenses(input);
}
