import { z } from 'zod/v4';
import {
  MAX_TAGS_PER_TRANSACTION,
  transactionKindSchema,
  type TransactionCreate,
} from 'pulpe-shared';

import { conversionFormSchema } from '@core/currency';

export const transactionFormDataSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  tagIds: z.array(z.uuid()).max(MAX_TAGS_PER_TRANSACTION),
  isChecked: z.boolean(),
  conversion: conversionFormSchema.nullable(),
  /**
   * Objectif d'épargne qui finance ce revenu (PUL-329). `null` hors du mode
   * retrait, et remis à `null` dès que le type quitte `income` : seul un revenu
   * peut sortir d'un objectif, et le contrat wire le refuse de toute façon.
   */
  sourceSavingsGoalId: z.uuid().nullable().default(null),
});

export type TransactionFormData = z.input<typeof transactionFormDataSchema>;

export const transactionCreateFromQuickFormSchema = transactionFormDataSchema
  .extend({
    budgetId: z.uuid(),
    transactionDate: z.iso.datetime({ offset: true }),
  })
  .transform(
    ({
      isChecked,
      conversion,
      tagIds,
      sourceSavingsGoalId,
      ...input
    }): TransactionCreate => ({
      ...input,
      tagIds: tagIds.length ? tagIds : undefined,
      checkedAt: isChecked ? new Date().toISOString() : null,
      // Le contrat wire n'accepte pas `null` : un revenu sans origine omet le
      // champ, il ne l'envoie pas vide.
      ...(sourceSavingsGoalId ? { sourceSavingsGoalId } : {}),
      ...(conversion ?? {}),
    }),
  );
