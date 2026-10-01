import {
  MAX_SAVINGS_GOAL_PLAN_PERIODS,
  type SavingsGoal,
  type SavingsGoalCreate,
  type SavingsGoalStatus,
  type SavingsGoalUpdate,
  suggestedMonthlyContribution,
} from "pulpe-shared";

import { toIsoDate } from "@/core/ui/date-format";

export interface SavingsGoalDraft {
  name: string;
  targetAmount: number | null;
  /** What is already put aside before the tracking starts. */
  initialAmount: number | null;
  startDate: string | null;
  targetDate: string | null;
  /** Turn the target into a monthly forecast on every budget until the date. */
  isDecomposed: boolean;
  /** What the user typed over the suggestion; `null` hands control back to it. */
  monthlyOverride: number | null;
  status: SavingsGoalStatus;
}

export function emptySavingsGoalDraft(): SavingsGoalDraft {
  return {
    name: "",
    targetAmount: null,
    initialAmount: null,
    startDate: null,
    targetDate: null,
    isDecomposed: true,
    monthlyOverride: null,
    status: "ACTIVE",
  };
}

export function savingsGoalDraftFrom(goal: SavingsGoal): SavingsGoalDraft {
  return {
    name: goal.name,
    targetAmount: goal.targetAmount,
    initialAmount: goal.initialAmount ?? null,
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    // Decomposition happens once, at creation; editing never re-runs it.
    isDecomposed: false,
    monthlyOverride: null,
    status: goal.status,
  };
}

/** What the target still asks for once the starting stock is counted. */
export function remainingToSave(draft: SavingsGoalDraft): number {
  if (draft.targetAmount === null) return 0;
  return draft.targetAmount - (draft.initialAmount ?? 0);
}

/**
 * Target ÷ months left, recomputed on every keystroke until the user overrides
 * it. Delegated to the shared calculator so the three clients divide the same
 * way — including the pay-day cycle and the ceil-to-the-cent.
 */
export function suggestedMonthly(
  draft: SavingsGoalDraft,
  payDayOfMonth: number | null,
  now?: Date,
): number | null {
  if (draft.targetAmount === null || draft.targetDate === null) return null;
  return suggestedMonthlyContribution({
    targetAmount: draft.targetAmount,
    targetDate: draft.targetDate,
    startDate: draft.startDate,
    payDayOfMonth,
    initialAmount: draft.initialAmount ?? 0,
    now,
  });
}

/**
 * The auto-decomposition is only offered when there is something left to
 * decompose: without a date there is no horizon, and a starting stock that
 * already covers the target would over-provision every month.
 */
export function canDecompose(draft: SavingsGoalDraft): boolean {
  return (
    draft.targetDate !== null &&
    draft.targetAmount !== null &&
    draft.targetAmount > 0 &&
    remainingToSave(draft) > 0
  );
}

/**
 * A goal with no date, or no target, can still be fed a fixed amount each
 * month — that is the pot, rather than the deadline.
 */
export function usesManualMonthly(draft: SavingsGoalDraft): boolean {
  return draft.targetDate === null || draft.targetAmount === null;
}

/** The deadlines the form may offer, as ISO `YYYY-MM-DD`, both included. */
export interface TargetDateBounds {
  earliest: string;
  latest: string;
}

/**
 * From today to the last day of the 120th month, the current one included —
 * what `savingsGoalCreateSchema` accepts. Without these the calendar offered
 * any day, the button stayed enabled, and the request was refused client-side
 * with nothing but a generic save error.
 *
 * A goal that already carries a date outside that range keeps it reachable,
 * as iOS bounds its picker (`SavingsGoalFormSheet.targetDateRange`): an edit
 * must not be forced to move a deadline it never touched.
 */
export function targetDateBounds(
  existingTarget: string | null,
  now: Date = new Date(),
): TargetDateBounds {
  const today = toIsoDate(now);
  // Day 0 of the month after the last one is that month's last day.
  const horizon = toIsoDate(
    new Date(
      now.getFullYear(),
      now.getMonth() + MAX_SAVINGS_GOAL_PLAN_PERIODS,
      0,
    ),
  );

  return {
    earliest:
      existingTarget !== null && existingTarget < today
        ? existingTarget
        : today,
    latest:
      existingTarget !== null && existingTarget > horizon
        ? existingTarget
        : horizon,
  };
}

/**
 * Whether the monthly amount the user typed is the one that will be sent. The
 * field is hidden otherwise, and a value left behind in it must neither block
 * the form nor be what its hint points at.
 */
function isMonthlyOverrideInUse(draft: SavingsGoalDraft): boolean {
  return canDecompose(draft) ? draft.isDecomposed : usesManualMonthly(draft);
}

export function isSavingsGoalDraftSubmittable(
  draft: SavingsGoalDraft,
  bounds: TargetDateBounds = targetDateBounds(null),
): boolean {
  if (draft.initialAmount !== null && draft.initialAmount < 0) return false;
  return savingsGoalDraftHint(draft, bounds) === null;
}

export type SavingsGoalDraftProblem =
  | "name"
  | "target"
  | "dates"
  | "pastDeadline"
  | "monthly";

/**
 * Why the form cannot be sent, in the order the fields read. Every reason the
 * button is disabled has one, so a greyed-out button is never left unexplained.
 */
export function savingsGoalDraftHint(
  draft: SavingsGoalDraft,
  bounds: TargetDateBounds = targetDateBounds(null),
): SavingsGoalDraftProblem | null {
  if (draft.name.trim() === "") return "name";
  if (draft.targetAmount !== null && draft.targetAmount <= 0) {
    return "target";
  }
  // ISO `YYYY-MM-DD` compares lexicographically the way it compares in time.
  if (
    draft.startDate !== null &&
    draft.targetDate !== null &&
    draft.startDate > draft.targetDate
  ) {
    return "dates";
  }
  if (draft.targetDate !== null && draft.targetDate < bounds.earliest) {
    return "pastDeadline";
  }
  if (
    isMonthlyOverrideInUse(draft) &&
    draft.monthlyOverride !== null &&
    draft.monthlyOverride <= 0
  ) {
    return "monthly";
  }
  return null;
}

/**
 * What actually gets sent as `monthlyContribution` — the field the server reads
 * to decide whether to generate forecasts at all. Sending it is opt-in: a goal
 * created without it is a target the user funds by hand.
 */
export function creationContribution(
  draft: SavingsGoalDraft,
  payDayOfMonth: number | null,
  now?: Date,
): number | null {
  if (canDecompose(draft)) {
    if (!draft.isDecomposed) return null;
    return draft.monthlyOverride ?? suggestedMonthly(draft, payDayOfMonth, now);
  }
  return usesManualMonthly(draft) ? draft.monthlyOverride : null;
}

export function buildSavingsGoalCreate(
  draft: SavingsGoalDraft,
  payDayOfMonth: number | null,
  now?: Date,
): SavingsGoalCreate {
  const contribution = creationContribution(draft, payDayOfMonth, now);
  return {
    name: draft.name.trim(),
    status: "ACTIVE",
    ...(draft.targetAmount === null
      ? {}
      : { targetAmount: draft.targetAmount }),
    ...(draft.startDate === null ? {} : { startDate: draft.startDate }),
    ...(draft.targetDate === null ? {} : { targetDate: draft.targetDate }),
    ...(draft.initialAmount === null
      ? {}
      : { initialAmount: draft.initialAmount }),
    ...(contribution === null || contribution <= 0
      ? {}
      : { monthlyContribution: contribution }),
  };
}

/**
 * Only what moved. A goal owns generated forecasts, so an unchanged field
 * resent is a chance for the server to reconcile something the user never
 * touched.
 */
export function buildSavingsGoalUpdate(
  draft: SavingsGoalDraft,
  goal: SavingsGoal,
): SavingsGoalUpdate {
  const changes: SavingsGoalUpdate = {};
  const name = draft.name.trim();
  if (name !== goal.name) changes.name = name;
  if (draft.targetAmount !== goal.targetAmount) {
    changes.targetAmount = draft.targetAmount;
  }
  if (draft.startDate !== goal.startDate) changes.startDate = draft.startDate;
  if (draft.targetDate !== goal.targetDate) {
    changes.targetDate = draft.targetDate;
  }
  const initial = draft.initialAmount ?? 0;
  if (initial !== (goal.initialAmount ?? 0)) changes.initialAmount = initial;
  if (draft.status !== goal.status) changes.status = draft.status;
  return changes;
}
