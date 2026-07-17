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
  /** Montant déjà épargné avant le suivi (stock one-shot). 0 = aucun. */
  initialAmount: number;
  targetDate: string;
  status: SavingsGoalCreate['status'];
}

/**
 * `monthlyContribution` (PUL-285 CA6) : montant mensuel choisi quand l'option
 * « décomposer en mensualités » est active — présence = opt-in serveur (la
 * prévision Épargne récurrente liée est générée sur le Mois Type par défaut).
 * Nul, absent ou non positif ⇒ création classique sans décomposition.
 *
 * `initialAmount` n'est envoyé que si positif — 0 (défaut du champ) est
 * équivalent à l'absence côté serveur (`.optional()`, aucun refine à respecter).
 */
export function buildSavingsGoalCreate(
  value: SavingsGoalFormValue,
  monthlyContribution?: number | null,
): SavingsGoalCreate {
  return savingsGoalCreateSchema.parse({
    name: value.name,
    targetAmount: value.targetAmount,
    targetDate: value.targetDate,
    status: value.status,
    ...(monthlyContribution != null && monthlyContribution > 0
      ? { monthlyContribution }
      : {}),
    ...(value.initialAmount > 0 ? { initialAmount: value.initialAmount } : {}),
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
  // original.initialAmount is nullable/optional (schemas.ts) — normalize to 0
  // so an unset baseline vs. an explicit 0 in the form don't look "changed".
  if (!original || value.initialAmount !== (original.initialAmount ?? 0)) {
    patch.initialAmount = value.initialAmount;
  }
  if (!original || value.targetDate !== original.targetDate) {
    patch.targetDate = value.targetDate;
  }
  if (!original || value.status !== original.status)
    patch.status = value.status;
  return savingsGoalUpdateSchema.parse(patch);
}
