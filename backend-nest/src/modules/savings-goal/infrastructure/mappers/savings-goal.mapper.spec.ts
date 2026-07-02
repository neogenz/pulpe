import { describe, it, expect } from 'bun:test';
import type { SavingsGoalProgressResult } from 'pulpe-shared';
import { SavingsGoalMapper } from './savings-goal.mapper';
import type { SavingsGoal } from '../../domain/savings-goal.entity';

const base: SavingsGoal = {
  id: 'goal-1',
  userId: 'user-1',
  name: 'Maison',
  targetAmount: 5000,
  targetDate: '2099-01-01',
  status: 'ACTIVE',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
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
    };

    it('flattens the goal identity fields and spreads every computed metric', () => {
      const progress = mapper.toProgressApi({ goal: base, computed });

      expect(progress.goalId).toBe(base.id);
      expect(progress.status).toBe('ACTIVE');
      expect(progress.targetAmount).toBe(5000);
      expect(progress.targetDate).toBe('2099-01-01');
      // Every computed metric is passed through unchanged.
      expect(progress).toMatchObject(computed);
    });

    it('mirrors the goal FX door-keepers — all null in v1 (CA6)', () => {
      const progress = mapper.toProgressApi({ goal: base, computed });

      expect(progress.originalTargetAmount).toBeNull();
      expect(progress.originalCurrency).toBeNull();
      expect(progress.targetCurrency).toBeNull();
      expect(progress.exchangeRate).toBeNull();
    });
  });
});
