import { describe, expect, it } from 'vitest';
import { type SavingsGoal } from 'pulpe-shared';
import {
  buildSavingsGoalCreate,
  buildSavingsGoalUpdate,
  type SavingsGoalFormValue,
} from './savings-goal-form-dialog.schema';

function isoDateOffsetMonths(months: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + months, 15)
    .toISOString()
    .slice(0, 10);
}

const FUTURE_DATE = isoDateOffsetMonths(1);
const BEYOND_PLAN_HORIZON = isoDateOffsetMonths(120);
const PAST_DATE = '2000-01-01';

const baseValue: SavingsGoalFormValue = {
  name: 'Vacances été',
  startDate: '',
  targetAmount: '3000',
  initialAmount: '',
  targetDate: FUTURE_DATE,
  status: 'ACTIVE',
};

describe('buildSavingsGoalCreate', () => {
  it('creates an open pot from its name alone', () => {
    expect(
      buildSavingsGoalCreate({
        ...baseValue,
        name: 'Coussin de sécurité',
        targetAmount: '',
        targetDate: '',
      }),
    ).toEqual({
      name: 'Coussin de sécurité',
      status: 'ACTIVE',
    });
  });

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

  it('rejects a target date beyond the 120th planning period', () => {
    expect(() =>
      buildSavingsGoalCreate({
        ...baseValue,
        targetDate: BEYOND_PLAN_HORIZON,
      }),
    ).toThrow();
  });

  it('rejects a non-positive target amount', () => {
    expect(() =>
      buildSavingsGoalCreate({ ...baseValue, targetAmount: '0' }),
    ).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => buildSavingsGoalCreate({ ...baseValue, name: '' })).toThrow();
  });

  it('carries monthlyContribution when the decompose option is active (PUL-285 CA6)', () => {
    expect(buildSavingsGoalCreate(baseValue, 250.5)).toEqual({
      name: 'Vacances été',
      targetAmount: 3000,
      targetDate: FUTURE_DATE,
      status: 'ACTIVE',
      monthlyContribution: 250.5,
    });
  });

  it('omits monthlyContribution when null, absent, or non-positive', () => {
    const expected = {
      name: 'Vacances été',
      targetAmount: 3000,
      targetDate: FUTURE_DATE,
      status: 'ACTIVE',
    };

    expect(buildSavingsGoalCreate(baseValue, null)).toEqual(expected);
    expect(buildSavingsGoalCreate(baseValue, 0)).toEqual(expected);
  });

  it('carries initialAmount when positive (PUL-293)', () => {
    expect(
      buildSavingsGoalCreate({ ...baseValue, initialAmount: '5000' }),
    ).toEqual({
      name: 'Vacances été',
      targetAmount: 3000,
      targetDate: FUTURE_DATE,
      status: 'ACTIVE',
      initialAmount: 5000,
    });
  });

  it('omits initialAmount when the field is empty', () => {
    expect(buildSavingsGoalCreate(baseValue)).toEqual({
      name: 'Vacances été',
      targetAmount: 3000,
      targetDate: FUTURE_DATE,
      status: 'ACTIVE',
    });
  });

  it('keeps a manual monthly contribution available without target or deadline', () => {
    expect(
      buildSavingsGoalCreate(
        {
          ...baseValue,
          name: 'Épargne libre',
          targetAmount: '',
          targetDate: '',
        },
        250,
      ),
    ).toEqual({
      name: 'Épargne libre',
      status: 'ACTIVE',
      monthlyContribution: 250,
    });
  });

  it('rejects a start date after the deadline', () => {
    expect(() =>
      buildSavingsGoalCreate({
        ...baseValue,
        startDate: isoDateOffsetMonths(2),
      }),
    ).toThrow();
  });
});

describe('buildSavingsGoalUpdate', () => {
  it('produces a SavingsGoalUpdate DTO (status change is valid)', () => {
    // No `original` passed → every field is sent (see buildSavingsGoalUpdate
    // JSDoc), initialAmount included.
    expect(
      buildSavingsGoalUpdate({ ...baseValue, status: 'COMPLETED' }),
    ).toEqual({
      name: 'Vacances été',
      targetAmount: 3000,
      initialAmount: 0,
      startDate: null,
      targetDate: FUTURE_DATE,
      status: 'COMPLETED',
    });
  });

  it('accepts an explicit past target date on update (no refine — D1 "repousser la date")', () => {
    expect(
      buildSavingsGoalUpdate({ ...baseValue, targetDate: PAST_DATE }),
    ).toEqual({
      name: 'Vacances été',
      targetAmount: 3000,
      initialAmount: 0,
      startDate: null,
      targetDate: PAST_DATE,
      status: 'ACTIVE',
    });
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
        startDate: '',
        targetAmount: '3000',
        initialAmount: '',
        targetDate: PAST_DATE,
        status: 'COMPLETED',
      },
      overdue,
    );

    // only the changed field is sent → no targetDate → past-date refine skipped
    expect(dto).toEqual({ status: 'COMPLETED' });
  });

  it('omits initialAmount when unchanged (PUL-293)', () => {
    const original = {
      id: '00000000-0000-4000-8000-0000000000a1',
      userId: '00000000-0000-4000-8000-0000000000b1',
      name: 'Vacances été',
      targetAmount: 3000,
      targetDate: FUTURE_DATE,
      status: 'ACTIVE',
      initialAmount: 5000,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as SavingsGoal;

    const dto = buildSavingsGoalUpdate(
      { ...baseValue, initialAmount: '5000', status: 'COMPLETED' },
      original,
    );

    expect(dto).toEqual({ status: 'COMPLETED' });
  });

  it('sends initialAmount: 0 as an explicit clear (0 is a meaningful change, not "absent")', () => {
    const original = {
      id: '00000000-0000-4000-8000-0000000000a1',
      userId: '00000000-0000-4000-8000-0000000000b1',
      name: 'Vacances été',
      targetAmount: 3000,
      targetDate: FUTURE_DATE,
      status: 'ACTIVE',
      initialAmount: 5000,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as SavingsGoal;

    const dto = buildSavingsGoalUpdate(
      { ...baseValue, initialAmount: '' },
      original,
    );

    expect(dto).toEqual({ initialAmount: 0 });
  });

  it('clears target, start and deadline explicitly with null', () => {
    const original = {
      id: '00000000-0000-4000-8000-0000000000a1',
      userId: '00000000-0000-4000-8000-0000000000b1',
      name: 'Vacances été',
      startDate: FUTURE_DATE,
      targetAmount: 3000,
      targetDate: isoDateOffsetMonths(2),
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as SavingsGoal;

    const dto = buildSavingsGoalUpdate(
      {
        ...baseValue,
        startDate: '',
        targetAmount: '',
        targetDate: '',
      },
      original,
    );

    expect(dto).toEqual({
      startDate: null,
      targetAmount: null,
      targetDate: null,
    });
  });

  it('leaves a never-set initial amount alone when the field stays empty (PUL-293)', () => {
    const original = {
      id: '00000000-0000-4000-8000-0000000000a1',
      userId: '00000000-0000-4000-8000-0000000000b1',
      name: 'Vacances été',
      targetAmount: 3000,
      targetDate: FUTURE_DATE,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as SavingsGoal;

    const dto = buildSavingsGoalUpdate(
      { ...baseValue, initialAmount: '', status: 'COMPLETED' },
      original,
    );

    expect(dto).toEqual({ status: 'COMPLETED' });
  });

  it('rejects a changed target date beyond the 120th planning period', () => {
    expect(() =>
      buildSavingsGoalUpdate(
        { ...baseValue, targetDate: BEYOND_PLAN_HORIZON },
        {
          id: '00000000-0000-4000-8000-0000000000a1',
          userId: '00000000-0000-4000-8000-0000000000b1',
          name: baseValue.name,
          startDate: null,
          targetAmount: 3000,
          targetDate: FUTURE_DATE,
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        } as SavingsGoal,
      ),
    ).toThrow();
  });
});
