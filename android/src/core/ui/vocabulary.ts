import type { BudgetLine, TransactionKind } from "pulpe-shared";

type Translate = (key: string) => string;

const RECURRENCES: readonly BudgetLine["recurrence"][] = ["fixed", "one_off"];
const KINDS: readonly TransactionKind[] = ["expense", "income", "saving"];

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

export function kindOptions(t: Translate) {
  return KINDS.map((value) => ({
    value,
    label: t(`vocabulary.kind.${value}`),
  }));
}

/**
 * The glyph each nature wears on its disc, everywhere a row opens on one. Five
 * files had written the same three names out; a sixth would have been one
 * chance for income to come out as a different arrow on one screen.
 */
export const KIND_ICONS = {
  income: "arrow-down",
  expense: "arrow-up",
  saving: "piggy-bank-outline",
} as const satisfies Record<TransactionKind, string>;
