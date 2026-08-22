import type {
  Transaction,
  TransactionCreate,
  TransactionKind,
  TransactionUpdate,
} from "pulpe-shared";

export interface TransactionDraft {
  budgetId: string;
  name: string;
  amount: number | null;
  kind: TransactionKind;
  /** The calendar day chosen in the picker; the clock time comes from `now`. */
  day: Date;
  isChecked: boolean;
  tagIds: string[];
  /**
   * The goal an income is taken out of (PUL-329). Only a free income can carry
   * one: allocated, the forecast it fills already names the origin, and the
   * create schema refuses both declarations at once.
   */
  sourceSavingsGoalId: string | null;
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
    throw new Error("A positive amount is required.");
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
    ...(draft.kind === "income" && draft.sourceSavingsGoalId !== null
      ? { sourceSavingsGoalId: draft.sourceSavingsGoalId }
      : {}),
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
export type TransactionDraftProblem = "amount" | "description";

export function draftHint(
  draft: TransactionDraft,
): TransactionDraftProblem | null {
  if (draft.amount === null || draft.amount <= 0) return "amount";
  if (draft.name.trim().length === 0) return "description";
  return null;
}

export function transactionDraftFrom(
  transaction: Transaction,
): TransactionDraft {
  return {
    budgetId: transaction.budgetId,
    name: transaction.name,
    amount: transaction.amount,
    kind: transaction.kind,
    day: new Date(transaction.transactionDate),
    isChecked: transaction.checkedAt !== null,
    tagIds: transaction.tagIds ?? [],
    sourceSavingsGoalId: transaction.sourceSavingsGoalId ?? null,
  };
}

/**
 * Only what moved, for the same reason as a forecast update: echoing untouched
 * fields back would overwrite another device's edit with what happened to be on
 * this screen.
 *
 * Three fields are deliberately unreachable here because the endpoint does not
 * take them — pointing has its own toggle, and both the envelope a transaction
 * answers to and the goal it came out of are decided once, when it is written.
 */
export function buildTransactionUpdate(
  draft: TransactionDraft,
  transaction: Transaction,
): TransactionUpdate {
  if (draft.amount === null || draft.amount <= 0) {
    throw new Error("A positive amount is required.");
  }

  const name = draft.name.trim();
  const original = new Date(transaction.transactionDate);
  // Moving the day keeps the original clock, so a day left alone rebuilds the
  // exact instant that was stored and drops out of the diff on its own.
  const day = atTimeOfDay(draft.day, original).toISOString();

  return {
    ...(name !== transaction.name ? { name } : {}),
    ...(draft.amount !== transaction.amount ? { amount: draft.amount } : {}),
    ...(draft.kind !== transaction.kind ? { kind: draft.kind } : {}),
    ...(day !== original.toISOString() ? { transactionDate: day } : {}),
    ...(haveSameTags(draft.tagIds, transaction.tagIds ?? [])
      ? {}
      : { tagIds: draft.tagIds }),
  };
}

/** Order carries no meaning in a tag list, so it must not count as a change. */
function haveSameTags(chosen: string[], stored: string[]): boolean {
  if (chosen.length !== stored.length) return false;
  const known = new Set(stored);
  return chosen.every((id) => known.has(id));
}

/**
 * The payload that puts a deleted transaction back exactly as it was. The
 * create schema accepts a client-chosen id, so undo restores the same row
 * rather than a look-alike — anything already pointing at it still points at
 * it.
 *
 * The savings origin is only ever *sent* for a free income. A realised planned
 * withdrawal carries one too, but allocated to the forecast that empties the
 * pot — and there the server reads the origin off that forecast. Declaring it
 * again would be a second declaration of origin, which the create schema
 * rejects (`transactionCreateSchema`, superRefine), taking the whole undo with
 * it.
 */
export function buildTransactionRestore(
  transaction: Transaction,
): TransactionCreate {
  const declarableOrigin =
    transaction.kind === "income" && transaction.budgetLineId === null
      ? (transaction.sourceSavingsGoalId ?? undefined)
      : undefined;

  return {
    id: transaction.id,
    budgetId: transaction.budgetId,
    name: transaction.name,
    amount: transaction.amount,
    kind: transaction.kind,
    transactionDate: transaction.transactionDate,
    checkedAt: transaction.checkedAt,
    ...(transaction.budgetLineId !== null
      ? { budgetLineId: transaction.budgetLineId }
      : {}),
    ...(transaction.tagIds !== undefined && transaction.tagIds.length > 0
      ? { tagIds: transaction.tagIds }
      : {}),
    ...(declarableOrigin !== undefined
      ? { sourceSavingsGoalId: declarableOrigin }
      : {}),
    ...(transaction.originalAmount != null
      ? { originalAmount: transaction.originalAmount }
      : {}),
    ...(transaction.originalCurrency != null
      ? { originalCurrency: transaction.originalCurrency }
      : {}),
    ...(transaction.targetCurrency != null
      ? { targetCurrency: transaction.targetCurrency }
      : {}),
    ...(transaction.exchangeRate != null
      ? { exchangeRate: transaction.exchangeRate }
      : {}),
  };
}
