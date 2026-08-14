import type { BudgetLine } from "pulpe-shared";

/**
 * The words the product uses for the things the schema names differently, in
 * one place. `fixed` and `one_off` are database values; "Récurrent" and "Prévu"
 * are what a person reads, and the app had six copies of that translation —
 * four label maps and two sets of segmented-button captions. Six copies of a
 * word is six chances for one screen to rename it alone.
 */
export const RECURRENCE_LABELS: Record<BudgetLine["recurrence"], string> = {
  fixed: "Récurrent",
  one_off: "Prévu",
};

/** The same two words, in the order the pickers offer them. */
export const RECURRENCE_OPTIONS = (
  Object.keys(RECURRENCE_LABELS) as BudgetLine["recurrence"][]
).map((value) => ({ value, label: RECURRENCE_LABELS[value] }));
