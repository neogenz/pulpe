import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputModule } from '@angular/material/input';
import { MatSliderHarness } from '@angular/material/slider/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavingsGoalPlanMonth, SavingsGoalProgress } from 'pulpe-shared';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { CurrencyInput } from '@ui/currency-input';
import { SavingsGoalStore } from '../../services/savings-goals-store';
import { GoalPlanSimulatorStore } from '../services/goal-plan-simulator-store';
import { GoalPlanSimulatorToolbar } from './goal-plan-simulator-toolbar';

const LINE_CURRENT = '11111111-1111-4111-8111-111111111111';
const LINE_FUTURE = '22222222-2222-4222-8222-222222222222';

function openMonth(
  month: number,
  budgetLineId: string,
  amount: number,
): SavingsGoalPlanMonth {
  return {
    month,
    year: 2026,
    state: month === 6 ? 'current' : 'future',
    isLocked: false,
    plannedAmount: amount,
    confirmedAmount: 0,
    plannedCumulative: amount,
    confirmedCumulative: 0,
    lines: [
      { budgetLineId, amount, checkedAt: null, isManuallyAdjusted: false },
    ],
  };
}

function makeProgress(): SavingsGoalProgress {
  return {
    goalId: 'goal-1',
    status: 'ACTIVE',
    targetAmount: 800,
    targetDate: '2026-08-01',
    plannedCumulative: 400,
    confirmed: 0,
    achievementPercent: 0,
    monthsElapsed: 1,
    monthsRemaining: 2,
    isOverdue: false,
    pace: 200,
    confirmedPace: 0,
    required: 200,
    projected: 400,
    paceStatus: 'behind',
    suggestCompletion: false,
    linkedLineCount: 2,
    cumulativeGap: 400,
    estimatedCompletion: null,
    months: [openMonth(6, LINE_CURRENT, 200), openMonth(7, LINE_FUTURE, 200)],
    originalTargetAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
  };
}

describe('GoalPlanSimulatorToolbar', () => {
  let fixture: ComponentFixture<GoalPlanSimulatorToolbar>;
  let simulator: GoalPlanSimulatorStore;

  beforeEach(async () => {
    const progress = signal<SavingsGoalProgress | null>(makeProgress());

    await TestBed.configureTestingModule({
      imports: [GoalPlanSimulatorToolbar],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        GoalPlanSimulatorStore,
        {
          provide: SavingsGoalStore,
          useValue: {
            progress,
            selectedGoal: signal(null),
            applyPlan: vi.fn(),
          },
        },
      ],
    })
      .overrideComponent(CurrencyInput, {
        set: {
          imports: [MatInputModule],
          template: `
            <input
              matInput
              type="number"
              [value]="value() ?? ''"
              (input)="value.set($any($event.target).valueAsNumber)"
              [attr.data-testid]="testId()"
            />
          `,
        },
      })
      .compileComponents();

    simulator = TestBed.inject(GoalPlanSimulatorStore);
    simulator.enter();
    fixture = TestBed.createComponent(GoalPlanSimulatorToolbar);
    setTestInput(fixture.componentInstance.currency, 'CHF');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('keeps rows, slider, and numeric input synchronized after redistribution and reset', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const redistribute = await loader.getHarness(
      MatButtonHarness.with({
        selector: '[data-testid="goal-plan-redistribute"]',
      }),
    );
    const reset = await loader.getHarness(
      MatButtonHarness.with({ selector: '[data-testid="goal-plan-revert"]' }),
    );
    const slider = await loader.getHarness(MatSliderHarness);
    const thumb = await slider.getEndThumb();
    const controlAmount = () =>
      (
        fixture.componentInstance as unknown as {
          sliderValue: () => number;
        }
      ).sliderValue();
    const editAmount = (value: number) =>
      (
        fixture.componentInstance as unknown as {
          onInputChange: (amount: number) => void;
        }
      ).onInputChange(value);

    expect(await thumb.getValue()).toBe(200);
    expect(controlAmount()).toBe(200);

    await redistribute.click();
    await fixture.whenStable();

    expect(simulator.draftRows().map((month) => month.simulatedAmount)).toEqual(
      [400, 400],
    );
    expect(controlAmount()).toBe(400);
    expect(await thumb.getValue()).toBe(400);

    await reset.click();
    await fixture.whenStable();

    expect(simulator.draftRows().map((month) => month.simulatedAmount)).toEqual(
      [200, 200],
    );
    expect(controlAmount()).toBe(200);
    expect(await thumb.getValue()).toBe(200);

    await thumb.setValue(300);
    await fixture.whenStable();

    expect(simulator.draftRows().map((month) => month.simulatedAmount)).toEqual(
      [300, 300],
    );
    expect(controlAmount()).toBe(300);

    editAmount(350);
    await fixture.whenStable();

    expect(simulator.draftRows().map((month) => month.simulatedAmount)).toEqual(
      [350, 350],
    );
    expect(controlAmount()).toBe(350);
    expect(await thumb.getValue()).toBe(350);
  });
});
