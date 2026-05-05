import { z } from 'zod/v4';
import { type BudgetCreate } from 'pulpe-shared';

export const BUDGET_DESCRIPTION_MAX_LENGTH = 100;

export const budgetCreationFormSchema = z
  .object({
    monthYear: z.date(),
    description: z.string().max(BUDGET_DESCRIPTION_MAX_LENGTH).trim(),
    templateId: z.uuid(),
  })
  .transform(
    (input): BudgetCreate => ({
      month: input.monthYear.getMonth() + 1,
      year: input.monthYear.getFullYear(),
      description: input.description,
      templateId: input.templateId,
    }),
  );

export type BudgetCreationFormValue = z.input<typeof budgetCreationFormSchema>;
