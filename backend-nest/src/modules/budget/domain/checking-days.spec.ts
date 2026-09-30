import { describe, expect, it } from 'bun:test';
import { checkingDays } from './checking-days';
import type { BudgetLineDecrypted } from './budget.entity';
import type { HistoryMonth } from './drift-history';

const line = {
  id: 'rent',
  name: 'Loyer',
  kind: 'expense',
  recurrence: 'fixed',
  templateLineId: null,
} as BudgetLineDecrypted;
const period = { month: 8, year: 2026 };
const months = (count: number, day = 5): HistoryMonth[] =>
  Array.from({ length: count }, (_, i) => ({
    month: 7 - i,
    year: 2026,
    transactions: [],
    budgetLines: [
      {
        ...line,
        amount: 1000,
        checkedAt: `2026-0${7 - i}-${String(day).padStart(2, '0')}T12:00:00Z`,
      },
    ],
  }));

describe('checkingDays', () => {
  it.each([0, 1, 2])('keeps the fallback with %i months', (count) => {
    expect(checkingDays([line], months(count), period, 1)).toEqual({});
  });
  it('uses a median despite an exceptional late month and unrelated unpointed lines', () => {
    const history = months(5);
    history[0].budgetLines[0].checkedAt = '2026-07-28T12:00:00Z';
    for (const m of history)
      m.budgetLines.push({
        ...line,
        id: 'other',
        name: 'Autre',
        amount: 1,
        checkedAt: null,
      });
    expect(checkingDays([line], history, period, 1)).toEqual({ rent: 5 });
  });
  it('does not infer habits for ambiguous current names or one-off items', () => {
    expect(
      checkingDays([line, { ...line, id: 'duplicate' }], months(3), period, 1),
    ).toEqual({});
    expect(
      checkingDays([{ ...line, recurrence: 'one_off' }], months(3), period, 1),
    ).toEqual({});
  });
  it('includes late checks on the last day and preserves end-of-period habits', () => {
    const history = months(3);
    history.forEach((m) => {
      m.budgetLines[0].checkedAt = new Date(
        m.year,
        m.month,
        0,
        23,
      ).toISOString();
    });
    expect(checkingDays([line], history, period, 1)).toEqual({ rent: 31 });
  });
  it('ignores retrospective checks, duplicate historical names and unpointed observations', () => {
    const history = months(3);
    history[0].budgetLines[0].checkedAt = '2026-08-01';
    history[1].budgetLines.push({
      ...history[1].budgetLines[0],
      id: 'duplicate',
    });
    history[2].budgetLines[0].checkedAt = null;
    expect(checkingDays([line], history, period, 1)).toEqual({});
  });
  it('keeps template identity across renames without mixing kinds', () => {
    const history = months(3);
    history.forEach((m) => {
      m.budgetLines[0].templateLineId = 'template';
    });
    expect(
      checkingDays(
        [{ ...line, name: 'Renamed', templateLineId: 'template' }],
        history,
        period,
        1,
      ),
    ).toEqual({ rent: 5 });
    expect(
      checkingDays(
        [{ ...line, kind: 'income', templateLineId: 'template' }],
        history,
        period,
        1,
      ),
    ).toEqual({});
  });
  it('uses pay-day periods, including the year boundary and short February', () => {
    const history = [1, 12, 11].map(
      (month): HistoryMonth => ({
        month,
        year: month === 1 ? 2026 : 2025,
        transactions: [],
        budgetLines: [
          {
            ...line,
            amount: 1,
            checkedAt: `${month === 1 ? 2026 : 2025}-${String(month).padStart(2, '0')}-02T12:00:00Z`,
          },
        ],
      }),
    );
    expect(checkingDays([line], history, { month: 3, year: 2026 }, 27)).toEqual(
      { rent: 6 },
    );
  });
});
