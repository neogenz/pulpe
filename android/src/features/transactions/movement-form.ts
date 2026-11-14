import type {
  BudgetPeriodDates,
  Transaction,
  TransactionKind,
} from "pulpe-shared";

import type { ForeignLeg } from "./movement-conversion";
import {
  defaultOperationDay,
  transactionDraftFrom,
  type TransactionDraft,
} from "./transaction-draft";

/** What an operation can be attached to, as far as this form is concerned. */
export interface EnvelopeTarget {
  id: string;
  name: string;
  kind: TransactionKind;
}

export type FormState = Omit<TransactionDraft, "budgetId">;

/**
 * The two ways an announced withdrawal is not ready to send, in the order the
 * user meets them. Both are refusals the server would state itself, and neither
 * is worth a round trip to hear.
 */
export function originProblemOf(input: {
  isActive: boolean;
  hasChosenGoal: boolean;
  remainingAfterWithdrawal: number | null;
}): "goal" | "exceedsGoal" | null {
  if (!input.isActive) return null;
  if (!input.hasChosenGoal) return "goal";
  if (
    input.remainingAfterWithdrawal !== null &&
    input.remainingAfterWithdrawal < 0
  ) {
    return "exceedsGoal";
  }
  return null;
}

export function initialForm(
  transaction: Transaction | undefined,
  envelope: EnvelopeTarget | undefined,
  period: BudgetPeriodDates | undefined,
  withdrawFromGoalId?: string,
  /** The figure it was typed as, for a movement entered in another currency. */
  foreign: ForeignLeg | null = null,
): FormState {
  if (transaction !== undefined) {
    const { budgetId: _budgetId, ...form } = transactionDraftFrom(transaction);
    return foreign === null ? form : { ...form, amount: foreign.amount };
  }

  return {
    name: "",
    amount: null,
    kind:
      withdrawFromGoalId !== undefined
        ? "income"
        : (envelope?.kind ?? "expense"),
    day: defaultOperationDay(new Date(), period),
    // An operation entered by hand is one the user has just seen happen, so it
    // arrives pointed; the toggle is there for the one they are anticipating.
    isChecked: true,
    tagIds: [],
    sourceSavingsGoalId: withdrawFromGoalId ?? null,
  };
}
