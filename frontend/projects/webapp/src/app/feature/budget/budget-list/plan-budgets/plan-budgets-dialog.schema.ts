import * as z from 'zod';
import {
  budgetGenerateSchema,
  periodFromIndex,
  periodIndex,
  type BudgetPeriod,
} from 'pulpe-shared';

export const END_BEFORE_START = 'end-before-start';
export const RANGE_TOO_LONG = 'range-too-long';

const toDate = ({ month, year }: BudgetPeriod): Date =>
  new Date(year, month - 1, 1);

const toPeriod = (date: Date): BudgetPeriod => ({
  month: date.getMonth() + 1,
  year: date.getFullYear(),
});

export const planBudgetCount = (start: Date, end: Date): number =>
  periodIndex(toPeriod(end)) - periodIndex(toPeriod(start)) + 1;

export function defaultPlanBudgetPeriods(current: BudgetPeriod): {
  startPeriod: Date;
  endPeriod: Date;
} {
  return {
    startPeriod: toDate(current),
    endPeriod: toDate(periodFromIndex(periodIndex(current) + 11)),
  };
}

export const planBudgetsFormSchema = z
  .strictObject({
    startPeriod: z.date(),
    endPeriod: z.date(),
    templateId: z.uuid(),
  })
  .superRefine(({ startPeriod, endPeriod }, context) => {
    const count = planBudgetCount(startPeriod, endPeriod);

    if (count < 1) {
      context.addIssue({
        code: 'custom',
        message: END_BEFORE_START,
        path: ['endPeriod'],
      });
    } else if (count > 36) {
      context.addIssue({
        code: 'custom',
        message: RANGE_TOO_LONG,
        path: ['endPeriod'],
      });
    }
  })
  .transform(({ startPeriod, endPeriod, templateId }, context) => {
    const result = budgetGenerateSchema.safeParse({
      templateId,
      startMonth: startPeriod.getMonth() + 1,
      startYear: startPeriod.getFullYear(),
      count: planBudgetCount(startPeriod, endPeriod),
    });
    if (result.success) return result.data;

    const issue = result.error.issues[0];
    context.addIssue({
      code: 'custom',
      message: issue?.message ?? 'invalid-budget-generation',
      path: issue?.path,
    });
    return z.NEVER;
  });

export type PlanBudgetsFormValue = z.input<typeof planBudgetsFormSchema>;
