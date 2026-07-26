import { describe, it, expect } from 'bun:test';
import type {
  SavingsGoalPlanMonth,
  SavingsGoalProgressResult,
} from 'pulpe-shared';
import { SavingsGoalMapper } from './savings-goal.mapper';
import type {
  SavingsGoal,
  SavingsGoalContribution,
} from '../../domain/savings-goal.entity';

const base: SavingsGoal = {
  id: 'goal-1',
  userId: 'user-1',
  name: 'Maison',
  startDate: null,
  targetAmount: 5000,
  targetDate: '2099-01-01',
  status: 'ACTIVE',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  initialAmount: null,
};

describe('SavingsGoalMapper', () => {
  const mapper = new SavingsGoalMapper();

  it('maps core fields and omits dropped priority', () => {
    const api = mapper.toApi(base);
    expect(api.id).toBe('goal-1');
    expect(api.targetAmount).toBe(5000);
    expect(api.status).toBe('ACTIVE');
    expect('priority' in api).toBe(false);
  });

  it('v1 FX is null/undefined (dormant door)', () => {
    const api = mapper.toApi(base);
    expect(api.originalTargetAmount).toBeUndefined();
    expect(api.originalCurrency).toBeUndefined();
    expect(api.targetCurrency).toBeUndefined();
    expect(api.exchangeRate).toBeUndefined();
  });

  it('exposes initialAmount (PUL-293), null passes through untouched', () => {
    expect(mapper.toApi(base).initialAmount).toBeNull();
    expect(mapper.toApi({ ...base, initialAmount: 2000 }).initialAmount).toBe(
      2000,
    );
  });

  it('serializes the dedicated original_target_amount field (not originalAmount)', () => {
    const api = mapper.toApi({
      ...base,
      originalTargetAmount: 4800,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 0.96,
    });
    expect(api.originalTargetAmount).toBe(4800);
    expect(api.originalCurrency).toBe('EUR');
    expect(api.targetCurrency).toBe('CHF');
    expect(api.exchangeRate).toBe(0.96);
    // The generic mapper would have emitted `originalAmount` — prove we don't.
    expect('originalAmount' in api).toBe(false);
  });

  describe('toProgressApi', () => {
    const computed: SavingsGoalProgressResult = {
      plannedCumulative: 500,
      plannedProjection: 2500,
      confirmed: 350,
      achievementPercent: 35,
      monthsElapsed: 2,
      monthsRemaining: 5,
      isOverdue: false,
      pace: 250,
      confirmedPace: 175,
      required: 130,
      projected: 1225,
      paceStatus: 'behind',
      suggestCompletion: false,
      linkedLineCount: 3,
      cumulativeGap: 150,
      estimatedCompletion: { month: 6, year: 2027 },
      initialAmount: 0,
    };

    const months: SavingsGoalPlanMonth[] = [];

    it('flattens the goal identity fields and spreads every computed metric', () => {
      const progress = mapper.toProgressApi({ goal: base, computed, months });

      expect(progress.goalId).toBe(base.id);
      expect(progress.status).toBe('ACTIVE');
      expect(progress.startDate).toBeNull();
      expect(progress.targetAmount).toBe(5000);
      expect(progress.targetDate).toBe('2099-01-01');
      // Every computed metric is passed through unchanged.
      expect(progress).toMatchObject(computed);
      // The timeline is serialized alongside the formulas.
      expect(progress.months).toBe(months);
    });

    it('passes nullable interval fields through without inventing values', () => {
      const progress = mapper.toProgressApi({
        goal: {
          ...base,
          startDate: '2026-08-01',
          targetAmount: null,
          targetDate: null,
        },
        computed: {
          ...computed,
          achievementPercent: null,
          monthsRemaining: null,
          required: null,
          projected: null,
          paceStatus: null,
          suggestCompletion: null,
          estimatedCompletion: null,
        },
        months,
      });

      expect(progress.startDate).toBe('2026-08-01');
      expect(progress.targetAmount).toBeNull();
      expect(progress.targetDate).toBeNull();
      expect(progress.achievementPercent).toBeNull();
      expect(progress.monthsRemaining).toBeNull();
    });

    it('mirrors the goal FX door-keepers — all null in v1 (CA6)', () => {
      const progress = mapper.toProgressApi({ goal: base, computed, months });

      expect(progress.originalTargetAmount).toBeNull();
      expect(progress.originalCurrency).toBeNull();
      expect(progress.targetCurrency).toBeNull();
      expect(progress.exchangeRate).toBeNull();
    });
  });

  describe('toContributionsApi', () => {
    const contribution: SavingsGoalContribution = {
      lineId: 'line-1',
      name: 'Épargne mensuelle',
      amount: 500,
      checkedAt: '2026-06-01T00:00:00Z',
      budgetMonth: 6,
      budgetYear: 2026,
      transactions: [
        {
          id: 'tx-1',
          budgetId: 'budget-1',
          budgetLineId: 'line-1',
          name: 'Virement épargne',
          amount: 150,
          originalAmount: null,
          originalCurrency: null,
          targetCurrency: null,
          exchangeRate: null,
          kind: 'saving',
          tagIds: [],
          transactionDate: '2026-06-15',
          checkedAt: '2026-06-15T00:00:00Z',
          createdAt: '2026-06-15T00:00:00Z',
          updatedAt: '2026-06-15T00:00:00Z',
        },
      ],
    };

    it('maps the line identity and its nested transactions through the common mapper', () => {
      const [api] = mapper.toContributionsApi([contribution]);

      expect(api.lineId).toBe('line-1');
      expect(api.name).toBe('Épargne mensuelle');
      expect(api.amount).toBe(500);
      expect(api.checkedAt).toBe('2026-06-01T00:00:00Z');
      expect(api.budgetMonth).toBe(6);
      expect(api.budgetYear).toBe(2026);

      expect(api.transactions).toHaveLength(1);
      const [tx] = api.transactions;
      expect(tx.id).toBe('tx-1');
      expect(tx.amount).toBe(150);
      // The nested transaction carries no budget period — that lives on the line.
      expect('budgetMonth' in tx).toBe(false);
      // v1 has no FX metadata — the common mapper leaves the door-keepers undefined.
      expect(tx.originalAmount).toBeUndefined();
    });
  });
});
