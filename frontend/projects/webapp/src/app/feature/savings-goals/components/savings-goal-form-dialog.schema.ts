import {
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
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

export function buildSavingsGoalUpdate(
  value: SavingsGoalFormValue,
): SavingsGoalUpdate {
  return savingsGoalUpdateSchema.parse({
    name: value.name,
    targetAmount: value.targetAmount,
    targetDate: value.targetDate,
    status: value.status,
  });
}
