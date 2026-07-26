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
 * Optional controls stay non-null in Signal Forms: an empty string means
 * "absent". Builders translate it to omission on CREATE and explicit null on
 * PATCH, so clearing a field never becomes an accidental no-op.
 */
export interface SavingsGoalFormValue {
  name: string;
  startDate: string;
  targetAmount: string;
  initialAmount: string;
  targetDate: string;
  status: SavingsGoalCreate['status'];
}

function optionalNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
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
  const targetAmount = optionalNumber(value.targetAmount);
  const initialAmount = optionalNumber(value.initialAmount);
  return savingsGoalCreateSchema.parse({
    name: value.name,
    ...(value.startDate ? { startDate: value.startDate } : {}),
    ...(targetAmount !== undefined ? { targetAmount } : {}),
    ...(value.targetDate ? { targetDate: value.targetDate } : {}),
    status: value.status,
    ...(monthlyContribution != null && monthlyContribution > 0
      ? { monthlyContribution }
      : {}),
    ...(initialAmount !== undefined && initialAmount > 0
      ? { initialAmount }
      : {}),
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
  const startDate = value.startDate || null;
  const targetAmount = optionalNumber(value.targetAmount) ?? null;
  const targetDate = value.targetDate || null;
  const initialAmount = optionalNumber(value.initialAmount) ?? 0;

  // A PATCH is sparse, but the form always holds the complete candidate.
  // Validate the interval before diffing so changing only one bound cannot
  // bypass the shared cross-field rule.
  if (startDate != null && targetDate != null && startDate > targetDate) {
    savingsGoalUpdateSchema.parse({ startDate, targetDate });
  }

  const patch: Partial<SavingsGoalUpdate> = {};
  if (!original || value.name !== original.name) patch.name = value.name;
  if (!original || targetAmount !== (original.targetAmount ?? null)) {
    patch.targetAmount = targetAmount;
  }
  if (!original || initialAmount !== (original.initialAmount ?? 0)) {
    patch.initialAmount = initialAmount;
  }
  if (!original || startDate !== (original.startDate ?? null)) {
    patch.startDate = startDate;
  }
  if (!original || targetDate !== (original.targetDate ?? null)) {
    patch.targetDate = targetDate;
  }
  if (!original || value.status !== original.status)
    patch.status = value.status;
  return savingsGoalUpdateSchema.parse(patch);
}
