import { describe, expect, it } from 'bun:test';
import {
  hasDeletionLinks,
  summarizeDeletionImpact,
  type BudgetDeletionLinkRows,
} from './budget-deletion';

type LineRow = BudgetDeletionLinkRows['lines'][number];
type MovementRow = BudgetDeletionLinkRows['movements'][number];

const line = (links: Partial<LineRow> = {}): LineRow => ({
  id: 'line-1',
  spreadGroupId: null,
  savingsGoalId: null,
  savingsWithdrawalGroupId: null,
  sourceSavingsGoalId: null,
  ...links,
});

const movement = (links: Partial<MovementRow> = {}): MovementRow => ({
  budgetLineId: null,
  sourceSavingsGoalId: null,
  ...links,
});

describe('summarizeDeletionImpact', () => {
  it('returns zeros for an empty month', () => {
    expect(summarizeDeletionImpact({ lines: [], movements: [] })).toEqual({
      forecastCount: 0,
      movementCount: 0,
      links: {
        spreadForecasts: 0,
        savingsGoalForecasts: 0,
        savingsWithdrawalForecasts: 0,
        savingsWithdrawalMovements: 0,
      },
    });
  });

  it('counts unlinked forecasts and movements without any link', () => {
    const impact = summarizeDeletionImpact({
      lines: [line(), line()],
      movements: [movement()],
    });

    expect(impact.forecastCount).toBe(2);
    expect(impact.movementCount).toBe(1);
    expect(Object.values(impact.links).every((count) => count === 0)).toBe(
      true,
    );
  });

  it('classifies each link category', () => {
    const impact = summarizeDeletionImpact({
      lines: [
        line({ spreadGroupId: 'spread-1' }),
        line({ savingsGoalId: 'goal-1' }),
        line({ savingsWithdrawalGroupId: 'withdrawal-1' }),
        line({ sourceSavingsGoalId: 'goal-1' }),
      ],
      movements: [],
    });

    expect(impact.links).toEqual({
      spreadForecasts: 1,
      savingsGoalForecasts: 1,
      savingsWithdrawalForecasts: 2,
      savingsWithdrawalMovements: 0,
    });
  });

  it('counts a goal forecast that also carries spread_group_id once, as a goal', () => {
    const impact = summarizeDeletionImpact({
      lines: [line({ savingsGoalId: 'goal-1', spreadGroupId: 'goal-1' })],
      movements: [],
    });

    expect(impact.links).toEqual({
      spreadForecasts: 0,
      savingsGoalForecasts: 1,
      savingsWithdrawalForecasts: 0,
      savingsWithdrawalMovements: 0,
    });
  });

  it('counts a spread the user aimed at a goal once, as a spread', () => {
    const impact = summarizeDeletionImpact({
      lines: [line({ savingsGoalId: 'goal-1', spreadGroupId: 'spread-1' })],
      movements: [],
    });

    expect(impact.links).toEqual({
      spreadForecasts: 1,
      savingsGoalForecasts: 0,
      savingsWithdrawalForecasts: 0,
      savingsWithdrawalMovements: 0,
    });
  });

  it('counts a withdrawal forecast that also carries a goal once, as a withdrawal', () => {
    const impact = summarizeDeletionImpact({
      lines: [
        line({
          savingsWithdrawalGroupId: 'withdrawal-1',
          savingsGoalId: 'goal-1',
          spreadGroupId: 'goal-1',
        }),
      ],
      movements: [],
    });

    expect(impact.links).toEqual({
      spreadForecasts: 0,
      savingsGoalForecasts: 0,
      savingsWithdrawalForecasts: 1,
      savingsWithdrawalMovements: 0,
    });
  });

  it('counts only movements with a source goal as withdrawal movements', () => {
    const impact = summarizeDeletionImpact({
      lines: [],
      movements: [
        movement({ sourceSavingsGoalId: 'goal-1' }),
        movement(),
        movement({ sourceSavingsGoalId: 'goal-2' }),
      ],
    });

    expect(impact.movementCount).toBe(3);
    expect(impact.links.savingsWithdrawalMovements).toBe(2);
  });

  it('counts a realized withdrawal once, through its forecast', () => {
    const impact = summarizeDeletionImpact({
      lines: [line({ id: 'withdrawal-line', sourceSavingsGoalId: 'goal-1' })],
      movements: [
        movement({
          budgetLineId: 'withdrawal-line',
          sourceSavingsGoalId: 'goal-1',
        }),
        movement({ sourceSavingsGoalId: 'goal-1' }),
      ],
    });

    expect(impact.links.savingsWithdrawalForecasts).toBe(1);
    expect(impact.links.savingsWithdrawalMovements).toBe(1);
  });

  it('still counts a withdrawal movement allocated to a plain forecast', () => {
    const impact = summarizeDeletionImpact({
      lines: [line({ id: 'income-line' })],
      movements: [
        movement({
          budgetLineId: 'income-line',
          sourceSavingsGoalId: 'goal-1',
        }),
      ],
    });

    expect(impact.links.savingsWithdrawalForecasts).toBe(0);
    expect(impact.links.savingsWithdrawalMovements).toBe(1);
  });
});

describe('hasDeletionLinks', () => {
  const noLinks = summarizeDeletionImpact({ lines: [line()], movements: [] });

  it('is false when no link count is above zero', () => {
    expect(hasDeletionLinks(noLinks)).toBe(false);
  });

  it.each([
    'spreadForecasts',
    'savingsGoalForecasts',
    'savingsWithdrawalForecasts',
    'savingsWithdrawalMovements',
  ] as const)('is true when %s is above zero', (key) => {
    expect(
      hasDeletionLinks({ ...noLinks, links: { ...noLinks.links, [key]: 1 } }),
    ).toBe(true);
  });
});
