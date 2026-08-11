import type {
  BudgetLine,
  BudgetLineCreate,
  BudgetLineUpdate,
  TransactionKind,
  TransactionRecurrence,
} from "pulpe-shared";

export interface BudgetLineDraft {
  name: string;
  amount: number | null;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
}

export function emptyBudgetLineDraft(): BudgetLineDraft {
  return {
    name: "",
    amount: null,
    kind: "expense",
    // Most of what a budget plans comes back every month; the one-off is the
    // exception the user reaches for.
    recurrence: "fixed",
  };
}

export function budgetLineDraftFrom(line: BudgetLine): BudgetLineDraft {
  return {
    name: line.name,
    amount: line.amount,
    kind: line.kind,
    recurrence: line.recurrence,
  };
}

export function isBudgetLineDraftSubmittable(draft: BudgetLineDraft): boolean {
  return draft.amount !== null && draft.amount > 0 && draft.name.trim() !== "";
}

/** What is still missing, one thing at a time — the amount before the name. */
export function budgetLineDraftHint(draft: BudgetLineDraft): string | null {
  if (draft.amount === null || draft.amount <= 0) return "Indique un montant";
  if (draft.name.trim() === "") return "Donne-lui un nom";
  return null;
}

export function buildBudgetLineCreate(
  draft: BudgetLineDraft,
  budgetId: string,
): BudgetLineCreate {
  if (draft.amount === null || draft.amount <= 0) {
    throw new Error("Un montant strictement positif est requis.");
  }

  return {
    budgetId,
    name: draft.name.trim(),
    amount: draft.amount,
    kind: draft.kind,
    recurrence: draft.recurrence,
    // The server owns this flag for lines it generates from a template; one
    // typed by hand has no template to have been adjusted away from.
    isManuallyAdjusted: false,
  };
}

/**
 * Only what actually moved. The update schema is partial, and sending back the
 * fields the user did not touch would overwrite a concurrent edit from another
 * device with values that were merely on screen.
 */
export function buildBudgetLineUpdate(
  draft: BudgetLineDraft,
  line: BudgetLine,
): BudgetLineUpdate {
  if (draft.amount === null || draft.amount <= 0) {
    throw new Error("Un montant strictement positif est requis.");
  }

  const name = draft.name.trim();

  return {
    id: line.id,
    ...(name !== line.name ? { name } : {}),
    ...(draft.amount !== line.amount ? { amount: draft.amount } : {}),
    ...(draft.kind !== line.kind ? { kind: draft.kind } : {}),
    ...(draft.recurrence !== line.recurrence
      ? { recurrence: draft.recurrence }
      : {}),
    // An amount typed over a template's own is precisely what this flag means.
    ...(draft.amount !== line.amount && line.templateLineId !== null
      ? { isManuallyAdjusted: true }
      : {}),
  };
}
