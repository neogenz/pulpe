import { describe, expect, it } from 'vitest';
import { type SavingsGoal } from 'pulpe-shared';
import {
  buildSavingsGoalCreate,
  buildSavingsGoalUpdate,
  type SavingsGoalFormValue,
} from './savings-goal-form-dialog.schema';

const FUTURE_DATE = '2099-12-31';
const PAST_DATE = '2000-01-01';

const baseValue: SavingsGoalFormValue = {
  name: 'Vacances été',
  targetAmount: 3000,
  targetDate: FUTURE_DATE,
  status: 'ACTIVE',
};

describe('buildSavingsGoalCreate', () => {
  it('produces a SavingsGoalCreate DTO from a valid form value', () => {
    expect(buildSavingsGoalCreate(baseValue)).toEqual({
      name: 'Vacances été',
      targetAmount: 3000,
      targetDate: FUTURE_DATE,
      status: 'ACTIVE',
    });
  });

  it('rejects a target date in the past (CA25 / targetDate refine)', () => {
    expect(() =>
      buildSavingsGoalCreate({ ...baseValue, targetDate: PAST_DATE }),
    ).toThrow();
  });

  it('rejects a non-positive target amount', () => {
    expect(() =>
      buildSavingsGoalCreate({ ...baseValue, targetAmount: 0 }),
    ).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => buildSavingsGoalCreate({ ...baseValue, name: '' })).toThrow();
  });
});

describe('buildSavingsGoalUpdate', () => {
  it('produces a SavingsGoalUpdate DTO (status change is valid)', () => {
    expect(
      buildSavingsGoalUpdate({ ...baseValue, status: 'COMPLETED' }),
    ).toEqual({
      name: 'Vacances été',
      targetAmount: 3000,
      targetDate: FUTURE_DATE,
      status: 'COMPLETED',
    });
  });

  it('rejects a past target date on update too', () => {
    expect(() =>
      buildSavingsGoalUpdate({ ...baseValue, targetDate: PAST_DATE }),
    ).toThrow();
  });

  it('keeps an overdue goal editable: a status-only change omits the unchanged past date', () => {
    const overdue = {
      id: '00000000-0000-4000-8000-0000000000a1',
      userId: '00000000-0000-4000-8000-0000000000b1',
      name: 'Vacances été',
      targetAmount: 3000,
      targetDate: PAST_DATE,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as SavingsGoal;

    const dto = buildSavingsGoalUpdate(
      {
        name: 'Vacances été',
        targetAmount: 3000,
        targetDate: PAST_DATE,
        status: 'COMPLETED',
      },
      overdue,
    );

    // only the changed field is sent → no targetDate → past-date refine skipped
    expect(dto).toEqual({ status: 'COMPLETED' });
  });
});
