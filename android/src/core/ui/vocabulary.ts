import type { BudgetLine } from "pulpe-shared";

type Translate = (key: string) => string;

const RECURRENCES: readonly BudgetLine["recurrence"][] = ["fixed", "one_off"];

/**
 * The words the product uses for the things the schema names differently, in
 * one place. The database values stay stable; only their presentation is
 * resolved, at render time, through the active catalog.
 */
export function recurrenceLabel(
  t: Translate,
  value: BudgetLine["recurrence"],
): string {
  return t(`vocabulary.recurrence.${value}`);
}

/** The same two words, in the order the pickers offer them. */
export function recurrenceOptions(t: Translate) {
  return RECURRENCES.map((value) => ({
    value,
    label: recurrenceLabel(t, value),
  }));
}
