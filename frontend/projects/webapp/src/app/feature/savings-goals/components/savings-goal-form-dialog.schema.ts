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
  /**
   * Montant déjà épargné avant le suivi (stock one-shot). 0 = aucun.
   * `null` quand l'utilisateur vide le champ : le binding number de
   * signal-forms écrit `null`, et le validateur optionnel le laisse passer
   * (`null >= 0` est vrai en JS). Champ vidé = aucun montant de départ,
   * normalisé en 0 par les builders — l'envoyer tel quel ferait jeter Zod.
   */
  initialAmount: number | null;
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
  const initialAmount = value.initialAmount ?? 0;
  return savingsGoalCreateSchema.parse({
    name: value.name,
    targetAmount: value.targetAmount,
    targetDate: value.targetDate,
    status: value.status,
    ...(monthlyContribution != null && monthlyContribution > 0
      ? { monthlyContribution }
      : {}),
    ...(initialAmount > 0 ? { initialAmount } : {}),
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
  // Both sides normalize to 0: original.initialAmount is nullable/optional
  // (schemas.ts) and the form holds null once the field is cleared, so an
  // unset baseline, a cleared field and an explicit 0 all mean "no initial
  // amount" — and 0, unlike null, is what the strict schema accepts.
  const initialAmount = value.initialAmount ?? 0;
  if (!original || initialAmount !== (original.initialAmount ?? 0)) {
    patch.initialAmount = initialAmount;
  }
  if (!original || value.targetDate !== original.targetDate) {
    patch.targetDate = value.targetDate;
  }
  if (!original || value.status !== original.status)
    patch.status = value.status;
  return savingsGoalUpdateSchema.parse(patch);
}
