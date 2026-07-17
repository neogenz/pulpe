import { z } from 'zod/v4';
import { type BudgetLineSavingsWithdrawalCreate } from 'pulpe-shared';
import { conversionFormSchema } from '@core/currency';

/**
 * Source of truth for the outgoing BudgetLineSavingsWithdrawalCreate DTO:
 * shared/schemas.ts (budgetLineSavingsWithdrawalCreateSchema).
 *
 * Pioche dans l'épargne (PUL-292): the dialog captures ONE amount and an optional
 * source. From it the server builds the linked couple (Revenu M / Épargne M+1).
 *
 * Divergences from the wire shape (why a `<form>.schema.ts` exists):
 * - `conversion` — nested UI FX object flattened into the wire's 4 fields
 *   (frozen FX, RG-009); `null` when no conversion happened.
 * - `groupId` — the idempotency key minted ONCE per dialog instance and replayed
 *   on submit retries so a double-tap replays the couple instead of duplicating
 *   it. Required here so a missing key is a parse error, never a silent no-op.
 * - `incomeName` / `savingName` — resolved by the dialog from validated copy
 *   (source input defaulting to « Mon épargne », and « Remettre sur ton
 *   épargne »); the backend has no i18n, so the client owns both names.
 */
export const budgetLineSavingsWithdrawalFromFormSchema = z
  .object({
    budgetId: z.uuid(),
    amount: z.number().positive(),
    incomeName: z.string().min(1).max(100).trim(),
    savingName: z.string().min(1).max(100).trim(),
    groupId: z.uuid(),
    conversion: conversionFormSchema.nullable(),
  })
  .transform(
    (input): BudgetLineSavingsWithdrawalCreate => ({
      budgetId: input.budgetId,
      amount: input.amount,
      incomeName: input.incomeName,
      savingName: input.savingName,
      groupId: input.groupId,
      ...(input.conversion
        ? {
            originalAmount: input.conversion.originalAmount,
            originalCurrency: input.conversion.originalCurrency,
            targetCurrency: input.conversion.targetCurrency,
            exchangeRate: input.conversion.exchangeRate,
          }
        : {}),
    }),
  );

export type BudgetLineSavingsWithdrawalFormValue = z.input<
  typeof budgetLineSavingsWithdrawalFromFormSchema
>;
