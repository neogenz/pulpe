import { afterEach, describe, expect, it, mock, setSystemTime } from 'bun:test';
import type { BudgetMonthReadPort } from '@modules/budget/domain/ports/budget-month-read.port';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import { GetCurrentMonthTool } from './get-current-month.tool';

afterEach(() => setSystemTime());

describe('GetCurrentMonthTool business timezone', () => {
  it.each([
    ['2026-08-31T21:59:59Z', null, 8, 2026],
    ['2026-08-31T22:00:00Z', null, 9, 2026],
    ['2026-12-31T23:00:00Z', null, 1, 2027],
    ['2026-09-04T22:00:00Z', 5, 9, 2026],
    ['2026-09-26T21:59:59Z', 27, 9, 2026],
    ['2026-09-26T22:00:00Z', 27, 10, 2026],
    ['2026-10-31T23:00:00Z', null, 11, 2026],
  ] as const)(
    'should resolve %s with payday %s as %s/%s in Zurich',
    async (instant, payDayOfMonth, month, year) => {
      setSystemTime(new Date(instant));
      const budgets = {
        readMonth: mock(async () => null),
        listMonths: async () => [],
      } satisfies BudgetMonthReadPort;
      const session = {
        user: { payDayOfMonth },
      } as unknown as AuthenticatedSupabaseProvider;

      const result = await new GetCurrentMonthTool(budgets, session).execute();

      expect(budgets.readMonth).toHaveBeenCalledWith(month, year);
      expect(result.text).toBe(`Aucun budget pour ${month}/${year}.`);
    },
  );
});
