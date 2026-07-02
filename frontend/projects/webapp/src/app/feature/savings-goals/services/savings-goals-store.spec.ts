import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import type { SavingsGoal, SavingsGoalProgress } from 'pulpe-shared';
import { SavingsGoalStore } from './savings-goals-store';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';

// ngx-ziflux 0.0.13 DataCache mock — MUST carry both `version` and
// `_dataVersion` signals or cachedResource crashes at first snapshot read.
const mockCache = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  has: vi.fn().mockReturnValue(false),
  invalidate: vi.fn(),
  deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  prefetch: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  clear: vi.fn(),
  clearDirty: vi.fn(),
  version: signal(0),
  _dataVersion: signal(0),
};

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    name: 'Vacances été 2027',
    targetAmount: 3000,
    targetDate: '2027-08-01',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as SavingsGoal;
}

function makeProgress(
  overrides: Partial<SavingsGoalProgress> = {},
): SavingsGoalProgress {
  return {
    goalId: 'goal-1',
    status: 'ACTIVE',
    targetAmount: 3000,
    targetDate: '2027-08-01',
    plannedCumulative: 1200,
    confirmed: 900,
    achievementPercent: 30,
    monthsElapsed: 3,
    monthsRemaining: 12,
    isOverdue: false,
    pace: 400,
    confirmedPace: 300,
    required: 175,
    projected: 4500,
    paceStatus: 'on_track',
    suggestCompletion: false,
    linkedLineCount: 2,
    originalTargetAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
    ...overrides,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('SavingsGoalStore', () => {
  let store: SavingsGoalStore;
  let mockApi: Partial<SavingsGoalApi>;

  const goals: SavingsGoal[] = [
    makeGoal({ id: 'goal-1', name: 'Vacances', status: 'ACTIVE' }),
    makeGoal({ id: 'goal-2', name: 'Voiture', status: 'PAUSED' }),
  ];

  beforeEach(() => {
    mockCache.get.mockReturnValue(null);
    mockCache.set.mockClear();
    mockCache.invalidate.mockClear();
    mockCache.deduplicate.mockImplementation(
      (_key: string[], fn: () => Promise<unknown>) => fn(),
    );

    mockApi = {
      getAll$: vi.fn().mockReturnValue(of({ data: goals, success: true })),
      getProgress$: vi
        .fn()
        .mockReturnValue(of({ data: makeProgress(), success: true })),
      create$: vi.fn(),
      update$: vi.fn(),
      delete$: vi.fn(),
      cache: mockCache as unknown as SavingsGoalApi['cache'],
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        SavingsGoalStore,
        { provide: SavingsGoalApi, useValue: mockApi },
      ],
    });

    store = TestBed.inject(SavingsGoalStore);
  });

  it('loads goals and computes goals/isEmpty', async () => {
    await settle();
    expect(store.goals().length).toBe(2);
    expect(store.isEmpty()).toBe(false);
  });

  it('isEmpty is true when there are no goals', async () => {
    mockApi.getAll$ = vi.fn().mockReturnValue(of({ data: [], success: true }));
    store = TestBed.inject(SavingsGoalStore);
    await settle();
    expect(store.isEmpty()).toBe(true);
  });

  it('addGoal creates via API and appends to state', async () => {
    const created = makeGoal({ id: 'goal-3', name: 'Mariage' });
    mockApi.create$ = vi
      .fn()
      .mockReturnValue(of({ data: created, success: true }));
    await settle();

    const result = await store.addGoal({
      name: 'Mariage',
      targetAmount: 5000,
      targetDate: '2028-06-01',
      status: 'ACTIVE',
    });

    expect(result.id).toBe('goal-3');
    expect(store.goals().some((g) => g.id === 'goal-3')).toBe(true);
  });

  it('addGoal throws when the API fails', async () => {
    mockApi.create$ = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('create failed')));
    await settle();
    await expect(
      store.addGoal({
        name: 'X',
        targetAmount: 1,
        targetDate: '2099-01-01',
        status: 'ACTIVE',
      }),
    ).rejects.toThrow();
  });

  it('editGoal updates a goal (status change) and persists the result', async () => {
    const updated = makeGoal({ id: 'goal-1', status: 'COMPLETED' });
    mockApi.update$ = vi
      .fn()
      .mockReturnValue(of({ data: updated, success: true }));
    await settle();

    await store.editGoal('goal-1', { status: 'COMPLETED' });

    expect(mockApi.update$).toHaveBeenCalledWith('goal-1', {
      status: 'COMPLETED',
    });
    expect(store.goals().find((g) => g.id === 'goal-1')?.status).toBe(
      'COMPLETED',
    );
  });

  it('editGoal rolls back the optimistic change on error', async () => {
    mockApi.update$ = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('update failed')));
    await settle();

    await expect(
      store.editGoal('goal-1', { status: 'PAUSED' }),
    ).rejects.toThrow();
    expect(store.goals().find((g) => g.id === 'goal-1')?.status).toBe('ACTIVE');
  });

  it('removeGoal optimistically removes then calls the API', async () => {
    mockApi.delete$ = vi
      .fn()
      .mockReturnValue(of({ success: true, message: 'deleted' }));
    await settle();

    const promise = store.removeGoal('goal-2');
    // optimistic removal is synchronous (onMutate)
    expect(store.goals().some((g) => g.id === 'goal-2')).toBe(false);
    await promise;
    expect(mockApi.delete$).toHaveBeenCalledWith('goal-2');
  });

  it('removeGoal rolls back when the API fails', async () => {
    mockApi.delete$ = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('delete failed')));
    await settle();

    await expect(store.removeGoal('goal-2')).rejects.toThrow();
    expect(store.goals().some((g) => g.id === 'goal-2')).toBe(true);
  });

  it('refresh reloads the resource', async () => {
    await settle();
    const reloadSpy = vi.spyOn(store.savingsGoals, 'reload');
    store.refresh();
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('loads progress for the selected goal via getProgress$', async () => {
    await settle();
    expect(store.progress()).toBeNull();

    store.setSelectedGoalId('goal-1');
    await settle();

    expect(mockApi.getProgress$).toHaveBeenCalledWith('goal-1');
    expect(store.progress()?.achievementPercent).toBe(30);
  });

  it('selectedGoal resolves from the loaded list', async () => {
    await settle();
    store.setSelectedGoalId('goal-2');
    expect(store.selectedGoal()?.name).toBe('Voiture');
  });

  it('completeGoal PATCHes status COMPLETED', async () => {
    const updated = makeGoal({ id: 'goal-1', status: 'COMPLETED' });
    mockApi.update$ = vi
      .fn()
      .mockReturnValue(of({ data: updated, success: true }));
    await settle();

    await store.completeGoal('goal-1');

    expect(mockApi.update$).toHaveBeenCalledWith('goal-1', {
      status: 'COMPLETED',
    });
  });

  it('reopenGoal PATCHes status ACTIVE', async () => {
    const updated = makeGoal({ id: 'goal-1', status: 'ACTIVE' });
    mockApi.update$ = vi
      .fn()
      .mockReturnValue(of({ data: updated, success: true }));
    await settle();

    await store.reopenGoal('goal-1');

    expect(mockApi.update$).toHaveBeenCalledWith('goal-1', {
      status: 'ACTIVE',
    });
  });
});
