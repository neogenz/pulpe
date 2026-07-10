import { z } from 'zod/v4';
import { transactionKindSchema } from 'pulpe-shared';
import { conversionFormSchema } from '@core/currency';

import type { TemplateLineFormInput } from '../services/template-line-store';

export const editTemplateLineFromFormSchema = z
  .object({
    name: z.string().min(2).max(100).trim(),
    amount: z.number().positive(),
    kind: transactionKindSchema,
    tagIds: z.array(z.uuid()).nullable().optional(),
    savingsGoalId: z.uuid().nullable().optional(),
    conversion: conversionFormSchema.nullable(),
  })
  .transform(
    (input): TemplateLineFormInput => ({
      name: input.name,
      amount: input.amount,
      kind: input.kind,
      tagIds: input.tagIds ?? [],
      savingsGoalId: input.savingsGoalId,
      ...(input.conversion ?? {}),
    }),
  );

export type EditTemplateLineFormValue = z.input<
  typeof editTemplateLineFromFormSchema
>;
