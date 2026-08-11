import type { TransactionCreate, TransactionKind } from "pulpe-shared";

export interface TransactionDraft {
  budgetId: string;
  name: string;
  amount: number | null;
  kind: TransactionKind;
  /** The calendar day chosen in the picker; the clock time comes from `now`. */
  day: Date;
  isChecked: boolean;
  tagIds: string[];
}

/**
 * Turns what the form holds into what the endpoint takes. Kept apart from the
 * sheet because the three quiet conversions in here — the trimmed name, the day
 * that borrows the current time, the tag list that disappears when empty — are
 * where a wrong payload would come from, and none of them is visible on screen.
 */
export function buildTransactionPayload(
  draft: TransactionDraft,
  now: Date,
): TransactionCreate {
  if (draft.amount === null || draft.amount <= 0) {
    throw new Error("Un montant strictement positif est requis.");
  }

  return {
    budgetId: draft.budgetId,
    name: draft.name.trim(),
    amount: draft.amount,
    kind: draft.kind,
    transactionDate: atTimeOfDay(draft.day, now).toISOString(),
    // The stamp is the moment of entry, never the chosen day: pointing says
    // "I have seen this happen", and that is happening now.
    checkedAt: draft.isChecked ? now.toISOString() : null,
    // An empty array would be a deliberate "no tags"; the field is simply not
    // part of the request when the user picked none.
    ...(draft.tagIds.length > 0 ? { tagIds: draft.tagIds } : {}),
  };
}

/**
 * A day picker hands back midnight. Every transaction entered on the same day
 * would then share one instant and sort arbitrarily, so the day keeps the
 * chosen date and takes the current clock — the same thing iOS's date-only
 * `DatePicker` does by leaving the bound date's time component alone.
 */
function atTimeOfDay(day: Date, now: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
}

export function isDraftSubmittable(draft: TransactionDraft): boolean {
  return (
    draft.name.trim().length > 0 && draft.amount !== null && draft.amount > 0
  );
}

/** What the form is still missing, in the order the user would fix it. */
export function draftHint(draft: TransactionDraft): string | null {
  if (draft.amount === null || draft.amount <= 0) return "Ajoute un montant";
  if (draft.name.trim().length === 0) return "Ajoute une description";
  return null;
}
