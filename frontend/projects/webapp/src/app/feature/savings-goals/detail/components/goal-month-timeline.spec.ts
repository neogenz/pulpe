import { describe, it, expect, beforeEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import { provideRouter } from '@angular/router';
import type {
  SavingsGoalContribution,
  SavingsGoalPlanMonth,
  SavingsGoalPlannedWithdrawal,
  SavingsGoalPlanOnlyWithdrawal,
  SavingsGoalWithdrawal,
  SavingsPlanSimulatedMonth,
  Transaction,
} from 'pulpe-shared';
import { GoalMonthTimeline } from './goal-month-timeline';
import { setTestInput } from '../../../../testing/signal-test-utils';
import { provideTranslocoForTest } from '../../../../testing/transloco-testing';

registerLocaleData(localeDE);

const BUDGET_ID = '00000000-0000-4000-8000-000000000100';
const MARCH = 2026 * 12 + 3;

function makeMonth(
  overrides: Partial<SavingsGoalPlanMonth> = {},
): SavingsGoalPlanMonth {
  return {
    month: 3,
    year: 2026,
    state: 'future',
    isLocked: false,
    plannedAmount: 450,
    confirmedAmount: 0,
    plannedCumulative: 450,
    confirmedCumulative: 0,
    lines: [
      {
        budgetLineId: '11111111-1111-4111-8111-111111111111',
        amount: 450,
        checkedAt: null,
        isManuallyAdjusted: false,
      },
    ],
    ...overrides,
  };
}

const planned: SavingsGoalPlannedWithdrawal = {
  budgetLineId: '00000000-0000-4000-8000-000000000301',
  budgetId: BUDGET_ID,
  name: 'Apport cuisine',
  month: 3,
  year: 2026,
  plannedAmount: 4_500,
  realizedAmount: 300,
  remainingAmount: 4_200,
  status: 'partially_realized',
};

const planOnly: SavingsGoalPlanOnlyWithdrawal = {
  planWithdrawalId: '00000000-0000-4000-8000-000000000401',
  name: 'Notaire',
  month: 3,
  year: 2026,
  plannedAmount: 800,
  origin: 'plan_only',
};

const realized: SavingsGoalWithdrawal = {
  transactionId: '00000000-0000-4000-8000-000000000200',
  budgetId: BUDGET_ID,
  name: 'Réparation toit',
  transactionDate: '2026-03-20T10:00:00.000Z',
  amount: 4_500,
  checkedAt: '2026-03-21T10:00:00.000Z',
};

describe('GoalMonthTimeline', () => {
  let fixture: ComponentFixture<GoalMonthTimeline>;
  let component: GoalMonthTimeline;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalMonthTimeline],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoalMonthTimeline);
    component = fixture.componentInstance;
    setTestInput(component.currency, 'CHF');
    setTestInput(component.locale, 'de-CH');
    setTestInput(component.canRepair, true);
    setTestInput(component.expanded, true);
  });

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }

  function queryAll(testId: string) {
    return fixture.debugElement.queryAll(By.css(`[data-testid="${testId}"]`));
  }

  function row(periodKey = MARCH): HTMLElement {
    return query(`goal-plan-row-${periodKey}`).nativeElement;
  }

  it('should render the plan amount adaptively and the balance compactly', () => {
    setTestInput(component.months, [
      makeMonth({ plannedAmount: 450, projectedCumulative: 3100 }),
    ]);
    fixture.detectChanges();

    const text = row().textContent ?? '';
    expect(text).toContain('450');
    expect(text).not.toContain('450.00');
    expect(text).toContain('3’100');
  });

  it('should mark the current month with its badge and date range', () => {
    setTestInput(component.months, [makeMonth({ state: 'current' })]);
    fixture.detectChanges();

    expect(query('goal-plan-current-badge')).toBeTruthy();
    expect(row().dataset['current']).toBe('true');
  });

  it('should announce the formatted amount and locked state for a checked row', () => {
    setTestInput(component.months, [
      makeMonth({
        lines: [
          {
            budgetLineId: '11111111-1111-4111-8111-111111111111',
            amount: 450,
            checkedAt: '2026-03-15T10:00:00.000Z',
            isManuallyAdjusted: false,
          },
        ],
      }),
    ]);
    fixture.detectChanges();

    expect(
      row().querySelector('[aria-label]')?.getAttribute('aria-label'),
    ).toBe('450 CHF, pointé, verrouillé');
    expect(row().textContent).toContain('Pointé');
  });

  it('should count the forecasts of a month carrying several', () => {
    const line = makeMonth().lines[0];
    setTestInput(component.months, [
      makeMonth({
        lines: [line, { ...line, budgetLineId: crypto.randomUUID() }],
      }),
    ]);
    fixture.detectChanges();

    expect(row().textContent).toContain('2 prévisions');
  });

  it('should show the availability chips and the plan-wide gap hint', () => {
    const empty = { plannedAmount: 0, lines: [] };
    setTestInput(component.months, [
      makeMonth({ month: 3, hasBudget: true, isProvisionable: true, ...empty }),
      makeMonth({
        month: 4,
        hasBudget: true,
        isProvisionable: false,
        ...empty,
      }),
      makeMonth({ month: 5, hasBudget: false, ...empty }),
    ]);
    fixture.detectChanges();

    expect(query('goal-plan-repair-chip')).toBeTruthy();
    expect(
      query('goal-plan-no-forecast-chip').nativeElement.textContent,
    ).toContain('Aucune épargne prévue');
    expect(queryAll('goal-plan-gap-chip')).toHaveLength(1);
    expect(query('goal-plan-gap-hint').nativeElement.textContent).toContain(
      '1 mois sans budget',
    );
  });

  it('should lock a realized plan withdrawal and open only the plan-linked budget', () => {
    setTestInput(component.editable, true);
    setTestInput(component.plannedWithdrawals, [
      { ...planned, budgetId: 'manual-budget' },
      {
        ...planned,
        budgetLineId: crypto.randomUUID(),
        budgetId: 'plan-budget',
        origin: 'plan_linked',
      },
    ]);
    setTestInput(component.months, [
      makeMonth({
        plannedWithdrawalAmount: 500,
        planLinkedWithdrawalAmount: 200,
        planWithdrawalDestination: 'linked_income',
        planWithdrawalConsumedAmount: 300,
      }),
    ]);
    fixture.detectChanges();

    expect(row().dataset['locked']).toBe('true');
    expect(row().querySelector('button')).toBeNull();
    expect(
      query('goal-plan-row-realized-lock').nativeElement.textContent,
    ).toContain('Ce retrait est déjà réalisé');
    expect(
      query('goal-plan-row-open-budget').nativeElement.getAttribute('href'),
    ).toBe('/budget/plan-budget');
  });

  it('should expand the real contributions of a month behind its chevron', () => {
    const tx = {
      id: crypto.randomUUID(),
      budgetId: BUDGET_ID,
      budgetLineId: null,
      name: 'Maison fafou',
      amount: 559,
      kind: 'saving',
      transactionDate: '2026-03-16T10:00:00.000Z',
      createdAt: '2026-03-16T10:00:00.000Z',
      updatedAt: '2026-03-16T10:00:00.000Z',
      checkedAt: null,
    } as Transaction;
    const contribution: SavingsGoalContribution = {
      lineId: crypto.randomUUID(),
      name: 'Épargne',
      amount: 1500,
      checkedAt: null,
      budgetMonth: 3,
      budgetYear: 2026,
      transactions: [tx],
    };
    setTestInput(component.months, [makeMonth()]);
    setTestInput(component.contributions, [contribution]);
    fixture.detectChanges();

    const toggle = query('goal-plan-real-toggle-button')
      .nativeElement as HTMLButtonElement;
    const nested = () =>
      query('goal-plan-real-transaction').nativeElement.parentElement
        .classList as DOMTokenList;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(nested()).toContain('sm:hidden');

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(nested()).not.toContain('sm:hidden');
    expect(
      query('goal-plan-real-transaction').nativeElement.textContent,
    ).toContain('559.00');
    expect(row().textContent).toContain('À pointer');
  });

  describe('withdrawals', () => {
    it('should insert each withdrawal after its month, signed, linked rows opening their budget', () => {
      setTestInput(component.months, [
        makeMonth({ projectedCumulative: 1000 }),
        makeMonth({ month: 4 }),
      ]);
      setTestInput(component.plannedWithdrawals, [planned]);
      setTestInput(component.planOnlyWithdrawals, [planOnly]);
      setTestInput(component.withdrawals, [realized]);
      fixture.detectChanges();

      const order = fixture.debugElement
        .queryAll(By.css('[data-testid]'))
        .map((el) => el.nativeElement.dataset['testid'] as string)
        .filter((id) => /^goal-plan-row-\d+$|withdrawal-row$/.test(id));
      expect(order).toEqual([
        `goal-plan-row-${MARCH}`,
        'savings-goal-planned-withdrawal-row',
        'savings-goal-plan-only-withdrawal-row',
        'savings-goal-withdrawal-row',
        `goal-plan-row-${MARCH + 1}`,
      ]);

      const linked = query('savings-goal-planned-withdrawal-row')
        .nativeElement as HTMLAnchorElement;
      expect(linked.getAttribute('href')).toBe(`/budget/${BUDGET_ID}`);
      expect(linked.textContent).toContain('Partiellement réalisé');
      expect(linked.textContent).toContain('-4’200 CHF');
      expect(linked.getAttribute('aria-label')).toContain('Ouvrir ce budget');

      const outside = query('savings-goal-plan-only-withdrawal-row')
        .nativeElement as HTMLElement;
      expect(outside.tagName).toBe('DIV');
      expect(outside.textContent).toContain('Hors budget');

      const real = query('savings-goal-withdrawal-row')
        .nativeElement as HTMLAnchorElement;
      expect(real.textContent).toContain('-4’500 CHF');
      expect(real.textContent).toContain('Réalisé · Pointé');
      expect(real.classList).not.toContain('text-error');
      // The last withdrawal of the month lands on the server's projection.
      expect(real.textContent).toContain('1’000');
    });

    it('should hide withdrawals while simulating', () => {
      const month = makeMonth();
      setTestInput(component.months, [month]);
      setTestInput(component.simulatedMonths, [
        {
          ...month,
          simulatedAmount: 450,
          simulatedCumulative: 450,
          isAdjusted: false,
        } as SavingsPlanSimulatedMonth,
      ]);
      setTestInput(component.editable, true);
      setTestInput(component.withdrawals, [realized]);
      fixture.detectChanges();

      expect(query('savings-goal-withdrawal-row')).toBeNull();
    });

    it('should hold a placeholder and pending balances while withdrawals load', () => {
      setTestInput(component.isWithdrawalsLoading, true);
      setTestInput(component.months, [
        makeMonth({ plannedWithdrawalAmount: 500 }),
      ]);
      fixture.detectChanges();

      expect(query('goal-withdrawals-loading')).toBeTruthy();
      expect(query('goal-plan-balance-pending')).toBeTruthy();
    });

    it('should report a failure inline with a real retry action', () => {
      const retries: void[] = [];
      component.retryRequested.subscribe(() => retries.push(undefined));
      setTestInput(component.hasWithdrawalsError, true);
      setTestInput(component.months, [makeMonth()]);
      fixture.detectChanges();

      expect(
        query('goal-withdrawals-error').nativeElement.textContent,
      ).toContain('Les soldes peuvent être incomplets');
      query('goal-withdrawals-retry').nativeElement.click();
      expect(retries).toHaveLength(1);
    });

    it('should say nothing when the goal was never drawn from', () => {
      setTestInput(component.months, [makeMonth()]);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain('Retrait');
    });
  });

  describe('simulation', () => {
    function openInlineEdit(): {
      input: HTMLInputElement;
      amounts: { month: number; year: number; amount: number }[];
      invalid: boolean[];
    } {
      setTestInput(component.months, [makeMonth({ state: 'current' })]);
      setTestInput(component.editable, true);
      fixture.detectChanges();

      const amounts: { month: number; year: number; amount: number }[] = [];
      const invalid: boolean[] = [];
      component.amountChange.subscribe((event) => amounts.push(event));
      component.invalidChange.subscribe((event) => invalid.push(event));

      query(`goal-plan-row-edit-${MARCH}`).nativeElement.click();
      fixture.detectChanges();

      return {
        input: query('goal-plan-row-input').nativeElement,
        amounts,
        invalid,
      };
    }

    function type(input: HTMLInputElement, value: string): void {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    it('should open a labelled outline field, focused, with the movement hint', () => {
      const { input } = openInlineEdit();

      const field = input.closest('mat-form-field') as HTMLElement;
      expect(field.classList).toContain('mat-form-field-appearance-outline');
      expect(field.textContent).toContain('Mouvement ce mois');
      expect(field.textContent).toContain('Positif = mettre de côté');
      expect(document.activeElement).toBe(input);
    });

    it('should emit amountChange while typing, negative movements included', () => {
      const { input, amounts, invalid } = openInlineEdit();

      type(input, '-500');

      expect(amounts).toEqual([{ month: 3, year: 2026, amount: -500 }]);
      expect(invalid.at(-1)).toBe(false);
      expect(query('goal-plan-row-error')).toBeNull();
      expect(input.getAttribute('aria-invalid')).toBe('false');
    });

    it('should treat an incomplete entry as pending rather than as an error', () => {
      const { input, amounts, invalid } = openInlineEdit();

      type(input, '');

      expect(amounts).toEqual([]);
      expect(invalid.at(-1)).toBe(true);
      expect(query('goal-plan-row-error')).toBeNull();
    });

    it('should show the field error on an unparseable entry', () => {
      const { input, invalid } = openInlineEdit();
      // A number field reports '' for « 12a »; only validity tells it apart.
      Object.defineProperty(input, 'validity', { value: { badInput: true } });

      type(input, '12a');
      fixture.detectChanges();

      expect(invalid.at(-1)).toBe(true);
      expect(query('goal-plan-row-error').nativeElement.textContent).toContain(
        'Saisis un montant valide',
      );
    });

    it('should close the field when it is left, keeping the movement', () => {
      const { input, amounts, invalid } = openInlineEdit();

      type(input, '-500');
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(amounts).toEqual([{ month: 3, year: 2026, amount: -500 }]);
      expect(invalid.at(-1)).toBe(false);
      expect(query('goal-plan-row-input')).toBeNull();
    });
  });

  it('should window the list and offer to see every month', () => {
    setTestInput(component.expanded, false);
    setTestInput(
      component.months,
      [1, 2, 3, 4, 5, 6].map((month) =>
        makeMonth({ month, isLocked: month <= 2 }),
      ),
    );
    fixture.detectChanges();

    expect(
      fixture.debugElement.queryAll(By.css('[data-testid^="goal-plan-row-"]')),
    ).toHaveLength(4);
    expect(query('goal-plan-see-all').nativeElement.textContent).toContain(
      'Voir les 6 mois',
    );
  });

  it('should keep offering to collapse once every month is shown', () => {
    setTestInput(component.expanded, true);
    setTestInput(
      component.months,
      [1, 2, 3, 4, 5, 6].map((month) =>
        makeMonth({ month, isLocked: month <= 2 }),
      ),
    );
    fixture.detectChanges();

    expect(query('goal-plan-see-all').nativeElement.textContent).toContain(
      'Réduire',
    );
  });
});
