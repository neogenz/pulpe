import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavingsGoal } from 'pulpe-shared';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { SavingsGoalPickerField } from './savings-goal-picker-field';

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

const goal = {
  id: 'goal-1',
  name: 'Vacances',
  userId: 'user-1',
  targetAmount: 3_000,
  targetDate: '2027-08-01',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as SavingsGoal;

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('SavingsGoalPickerField', () => {
  const getAll$ = vi.fn();

  beforeEach(async () => {
    getAll$.mockReset();
    mockCache.get.mockReturnValue(null);
    mockCache.set.mockClear();
    mockCache.invalidate.mockClear();
    mockCache.deduplicate.mockImplementation(
      (_key: string[], fn: () => Promise<unknown>) => fn(),
    );

    await TestBed.configureTestingModule({
      imports: [SavingsGoalPickerField],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        {
          provide: SavingsGoalApi,
          useValue: {
            cache: mockCache,
            getAll$,
          },
        },
      ],
    }).compileComponents();
  });

  it('renders loading, error with retry, then successful empty distinctly', async () => {
    const initialRequest = new Subject<unknown>();
    getAll$
      .mockReturnValueOnce(initialRequest.asObservable())
      .mockReturnValueOnce(of({ data: [], success: true }));
    const fixture = TestBed.createComponent(SavingsGoalPickerField);

    fixture.detectChanges();
    expect(
      fixture.debugElement.query(
        By.css('[data-testid="savings-goal-picker-loading"]'),
      ),
    ).toBeTruthy();

    initialRequest.error(new Error('network'));
    await settle();
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(
        By.css('[data-testid="savings-goal-picker-error"]'),
      ),
    ).toBeTruthy();

    fixture.debugElement
      .query(By.css('[data-testid="savings-goal-picker-retry"]'))
      .nativeElement.click();
    await settle();
    fixture.detectChanges();

    expect(getAll$).toHaveBeenCalledTimes(2);
    expect(
      fixture.debugElement.query(
        By.css('[data-testid="savings-goal-picker-empty"]'),
      ),
    ).toBeTruthy();
  });

  it('reconciles a missing value only after a successful load', async () => {
    getAll$
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValueOnce(of({ data: [goal], success: true }));
    const fixture = TestBed.createComponent(SavingsGoalPickerField);
    setTestInput(fixture.componentInstance.value, 'deleted-goal');
    const emitted = vi.spyOn(fixture.componentInstance.valueChanged, 'emit');

    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    TestBed.flushEffects();
    expect(emitted).not.toHaveBeenCalled();

    fixture.debugElement
      .query(By.css('[data-testid="savings-goal-picker-retry"]'))
      .nativeElement.click();
    await settle();
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(getAll$).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveBeenCalledOnce();
    expect(emitted).toHaveBeenCalledWith(null);
  });
});
