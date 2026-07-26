import { type ComponentFixture, TestBed } from '@angular/core/testing';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  provideZonelessChangeDetection,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputModule } from '@angular/material/input';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSliderHarness } from '@angular/material/slider/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavingsGoalPlanMonth, SavingsGoalProgress } from 'pulpe-shared';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { CurrencyInput } from '@ui/currency-input';
import { SavingsGoalStore } from '../../services/savings-goals-store';
import { GoalPlanSimulatorStore } from '../services/goal-plan-simulator-store';
import { GoalPlanSimulatorToolbar } from './goal-plan-simulator-toolbar';

@Component({
  selector: 'pulpe-currency-input',
  imports: [MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      matInput
      type="number"
      [value]="value ?? ''"
      (input)="valueChange.emit($any($event.target).valueAsNumber)"
      [placeholder]="placeholder"
      [attr.aria-label]="label + ' in ' + currency"
      [attr.data-testid]="testId"
    />
  `,
})
class StubCurrencyInput {
  @Input() label = '';
  @Input() value: number | null = null;
  @Input() currency = 'CHF';
  @Input() autoFocus = true;
  @Input() testId = 'currency-input';
  @Input() placeholder = '0.00';
  @Output() readonly valueChange = new EventEmitter<number | null>();
}

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
    startDate: null,
    targetAmount: 800,
    targetDate: '2026-08-01',
    plannedCumulative: 400,
    plannedProjection: 400,
    confirmed: 0,
    initialAmount: 0,
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
  let progressSig: ReturnType<typeof signal<SavingsGoalProgress | null>>;

  beforeEach(async () => {
    progressSig = signal<SavingsGoalProgress | null>(makeProgress());

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
            progress: progressSig,
            selectedGoal: signal(null),
            applyPlan: vi.fn(),
          },
        },
      ],
    })
      .overrideComponent(GoalPlanSimulatorToolbar, {
        remove: { imports: [CurrencyInput] },
        add: { imports: [StubCurrencyInput] },
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
    const amountInput = await loader.getHarness(
      MatInputHarness.with({
        selector: '[data-testid="goal-plan-amount-input"]',
      }),
    );

    expect(await thumb.getValue()).toBe(200);
    expect(await amountInput.getValue()).toBe('200');

    await redistribute.click();
    await fixture.whenStable();

    expect(simulator.draftRows().map((month) => month.simulatedAmount)).toEqual(
      [400, 400],
    );
    expect(await thumb.getValue()).toBe(400);
    expect(await amountInput.getValue()).toBe('400');

    await reset.click();
    await fixture.whenStable();

    expect(simulator.draftRows().map((month) => month.simulatedAmount)).toEqual(
      [200, 200],
    );
    expect(await thumb.getValue()).toBe(200);
    expect(await amountInput.getValue()).toBe('200');

    await thumb.setValue(300);
    await fixture.whenStable();

    expect(simulator.draftRows().map((month) => month.simulatedAmount)).toEqual(
      [300, 300],
    );
    expect(await amountInput.getValue()).toBe('300');

    await amountInput.setValue('350');
    await fixture.whenStable();

    expect(simulator.draftRows().map((month) => month.simulatedAmount)).toEqual(
      [350, 350],
    );
    expect(await thumb.getValue()).toBe(350);
    expect(await amountInput.getValue()).toBe('350');
  });

  it('shows the deadline target hint until the goal is reached', async () => {
    // targetReached defaults to false → « Vise X/mois pour atteindre ta cible ».
    const hint = fixture.nativeElement.querySelector(
      '[data-testid="goal-plan-target-hint"]',
    );
    expect(hint).not.toBeNull();
    // The suggested amount is the deadline rhythm — « pour tenir l'échéance » =
    // required = 200 — NOT the plan-horizon spread (target 800 / 2 months = 400).
    // Guards that the hint stays anchored on the deadline, not the plan length.
    expect(hint?.textContent).toContain('200');
    expect(hint?.textContent).not.toContain('400');

    setTestInput(fixture.componentInstance.targetReached, true);
    fixture.detectChanges();
    await fixture.whenStable();

    // Reached → the aim-for hint disappears (nothing left to aim for).
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="goal-plan-target-hint"]',
      ),
    ).toBeNull();
  });

  it('renders cents-preserving non-uniform redistribution as mixed', async () => {
    progressSig.set({ ...makeProgress(), targetAmount: 800.01 });
    await fixture.whenStable();

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const redistribute = await loader.getHarness(
      MatButtonHarness.with({
        selector: '[data-testid="goal-plan-redistribute"]',
      }),
    );
    const slider = await loader.getHarness(MatSliderHarness);
    const amountInput = await loader.getHarness(
      MatInputHarness.with({
        selector: '[data-testid="goal-plan-amount-input"]',
      }),
    );

    await redistribute.click();
    await fixture.whenStable();

    expect(simulator.draftRows().map((month) => month.simulatedAmount)).toEqual(
      [400.01, 400],
    );
    // Variable amounts no longer disable the slider (that trapped the user).
    // The slider stays active + seeded on the deadline anchor; a visible hint
    // explains that touching it uniformises the months.
    expect(await slider.isDisabled()).toBe(false);
    expect(await amountInput.getValue()).not.toBe('');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="goal-plan-variable-hint"]',
      ),
    ).not.toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="goal-plan-slider"]')
        ?.getAttribute('aria-label'),
    ).toBe('Chaque mois, je mets');

    await amountInput.setValue('350');
    await fixture.whenStable();

    expect(await slider.isDisabled()).toBe(false);
    expect(simulator.draftRows().map((month) => month.simulatedAmount)).toEqual(
      [350, 350],
    );
    // Uniformised → the variable hint disappears.
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="goal-plan-variable-hint"]',
      ),
    ).toBeNull();
  });
});
