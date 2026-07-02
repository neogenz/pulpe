import {
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
  type SavingsGoal,
  type SavingsGoalCreate,
  type SavingsGoalUpdate,
} from 'pulpe-shared';

/**
 * Form-derived shape for the savings-goal create/edit dialog.
 *
 * Source of truth for the outgoing DTOs: shared/schemas.ts
 * (savingsGoalCreateSchema / savingsGoalUpdateSchema). The dialog parses its
 * raw model through those schemas so the same validation (targetDate ≥ today,
 * targetAmount positive, name length) runs client-side before the request.
 *
 * targetDate stays a STRING ('YYYY-MM-DD') end to end — never a Date.
 */
export interface SavingsGoalFormValue {
  name: string;
  targetAmount: number;
  targetDate: string;
  status: SavingsGoalCreate['status'];
}

export function buildSavingsGoalCreate(
  value: SavingsGoalFormValue,
): SavingsGoalCreate {
  return savingsGoalCreateSchema.parse({
    name: value.name,
    targetAmount: value.targetAmount,
    targetDate: value.targetDate,
    status: value.status,
  });
}

/**
 * Builds a PATCH payload containing ONLY the fields the user changed.
 *
 * `savingsGoalUpdateSchema.targetDate` carries no past-date refine (unlike
 * create) — an overdue goal stays editable, and D1's "repousser la date" CTA
 * can move a goal's deadline in either direction. Diffing against `original`
 * is purely a payload-size optimization (skip unchanged fields), not a
 * correctness requirement. When `original` is absent every field is sent
 * (and re-validated).
 */
export function buildSavingsGoalUpdate(
  value: SavingsGoalFormValue,
  original?: SavingsGoal,
): SavingsGoalUpdate {
  const patch: Partial<SavingsGoalUpdate> = {};
  if (!original || value.name !== original.name) patch.name = value.name;
  if (!original || value.targetAmount !== original.targetAmount) {
    patch.targetAmount = value.targetAmount;
  }
  if (!original || value.targetDate !== original.targetDate) {
    patch.targetDate = value.targetDate;
  }
  if (!original || value.status !== original.status)
    patch.status = value.status;
  return savingsGoalUpdateSchema.parse(patch);
}
