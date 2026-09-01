import { describe, expect, it } from 'vitest';
import {
  defaultPlanBudgetPeriods,
  END_BEFORE_START,
  planBudgetsFormSchema,
  RANGE_TOO_LONG,
} from './plan-budgets-dialog.schema';

const TEMPLATE_ID = '00000000-0000-4000-8000-000000000001';

describe('planBudgetsFormSchema', () => {
  it('defaults to twelve inclusive periods across a year boundary', () => {
    const defaults = defaultPlanBudgetPeriods({ month: 9, year: 2026 });

    expect(defaults.startPeriod).toEqual(new Date(2026, 8, 1));
    expect(defaults.endPeriod).toEqual(new Date(2027, 7, 1));
    expect(
      planBudgetsFormSchema.parse({ ...defaults, templateId: TEMPLATE_ID }),
    ).toEqual({
      templateId: TEMPLATE_ID,
      startMonth: 9,
      startYear: 2026,
      count: 12,
    });
  });

  it('counts both endpoints', () => {
    expect(
      planBudgetsFormSchema.parse({
        startPeriod: new Date(2026, 11, 1),
        endPeriod: new Date(2027, 1, 1),
        templateId: TEMPLATE_ID,
      }).count,
    ).toBe(3);
  });

  it.each([
    [new Date(2026, 8, 1), new Date(2026, 7, 1), END_BEFORE_START],
    [new Date(2026, 0, 1), new Date(2029, 0, 1), RANGE_TOO_LONG],
  ])('rejects invalid range %s → %s', (startPeriod, endPeriod, message) => {
    const result = planBudgetsFormSchema.safeParse({
      startPeriod,
      endPeriod,
      templateId: TEMPLATE_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      message,
      path: ['endPeriod'],
    });
  });
});
