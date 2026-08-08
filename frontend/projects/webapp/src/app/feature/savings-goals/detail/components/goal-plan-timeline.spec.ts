import { describe, it, expect, beforeEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import type { SavingsGoalPlanMonth } from 'pulpe-shared';
import { GoalPlanTimeline } from './goal-plan-timeline';
import { setTestInput } from '../../../../testing/signal-test-utils';
import { provideTranslocoForTest } from '../../../../testing/transloco-testing';

registerLocaleData(localeDE);

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

describe('GoalPlanTimeline', () => {
  let fixture: ComponentFixture<GoalPlanTimeline>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalPlanTimeline],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoalPlanTimeline);
    setTestInput(fixture.componentInstance.currency, 'CHF');
    setTestInput(fixture.componentInstance.locale, 'de-CH');
    setTestInput(fixture.componentInstance.canRepair, true);
  });

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }

  function rowsQuery() {
    return fixture.debugElement.queryAll(
      By.css('[data-testid^="goal-plan-row-"]'),
    );
  }

  it('renders a row per month with amount (1.2-2) and cumulative (1.0-0)', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({ month: 2, plannedAmount: 450, plannedCumulative: 450 }),
      makeMonth({ month: 3, plannedAmount: 450, plannedCumulative: 900 }),
    ]);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    const rows = rowsQuery();
    expect(rows.length).toBe(2);
    // Ligne amount keeps decimals; cumulative aggregation drops them.
    expect(rows[0].nativeElement.textContent).toContain('450.00');
    expect(rows[1].nativeElement.textContent).toContain('900');
  });

  it('announces the formatted amount and locked state for a checked row', () => {
    setTestInput(fixture.componentInstance.months, [
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

    const amount = rowsQuery()[0].nativeElement.querySelector(
      'span[aria-label]',
    ) as HTMLSpanElement;
    expect(amount.getAttribute('aria-label')).toBe(
      '450.00 CHF, pointé, verrouillé',
    );
  });

  it('does not add a locked amount aria-label to an unchecked row', () => {
    setTestInput(fixture.componentInstance.months, [makeMonth()]);
    fixture.detectChanges();

    expect(
      rowsQuery()[0].nativeElement.querySelector('span[aria-label]'),
    ).toBeNull();
  });

  it('distinguishes missing, repairable, non-actionable and linked forecasts', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({ month: 3, state: 'current' }),
      makeMonth({
        month: 4,
        state: 'gap',
        hasBudget: false,
        isProvisionable: true,
        plannedAmount: 0,
        plannedCumulative: 900,
        lines: [],
      }),
      makeMonth({
        month: 5,
        state: 'gap',
        hasBudget: true,
        isProvisionable: true,
        plannedAmount: 0,
        plannedCumulative: 900,
        lines: [],
      }),
      makeMonth({
        month: 6,
        state: 'gap',
        hasBudget: true,
        isProvisionable: false,
        plannedAmount: 0,
        plannedCumulative: 900,
        lines: [],
      }),
      makeMonth({ month: 7, hasBudget: true }),
    ]);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    expect(query('goal-plan-current-badge')).toBeTruthy();
    expect(
      fixture.debugElement.queryAll(
        By.css('[data-testid="goal-plan-gap-chip"]'),
      ),
    ).toHaveLength(1);
    expect(query('goal-plan-repair-chip')).toBeTruthy();
    expect(
      query('goal-plan-no-forecast-chip').nativeElement.textContent,
    ).toContain('Aucune épargne prévue');
    expect(query('goal-plan-gap-hint')).toBeTruthy();
  });

  it('shows the repair chip for a current month with a budget and no linked forecast', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({
        month: 3,
        state: 'current',
        hasBudget: true,
        isProvisionable: true,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
    ]);
    fixture.detectChanges();

    expect(query('goal-plan-repair-chip')).toBeTruthy();
  });

  it('falls back to the no-forecast chip when the plan offers no repair', () => {
    setTestInput(fixture.componentInstance.canRepair, false);
    setTestInput(fixture.componentInstance.months, [
      makeMonth({
        month: 3,
        state: 'current',
        hasBudget: true,
        isProvisionable: true,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
    ]);
    fixture.detectChanges();

    expect(query('goal-plan-repair-chip')).toBeFalsy();
    expect(query('goal-plan-no-forecast-chip')).toBeTruthy();
  });

  it('shows the no-forecast and gap chips for a current month, same as for a gap month', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({
        month: 3,
        state: 'current',
        hasBudget: true,
        isProvisionable: false,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
      makeMonth({
        month: 4,
        state: 'current',
        hasBudget: false,
        isProvisionable: false,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
    ]);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    expect(query('goal-plan-no-forecast-chip')).toBeTruthy();
    expect(query('goal-plan-gap-chip')).toBeTruthy();
  });

  it('counts a current month with no budget in the gap hint, same as the pastille it shows', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({
        month: 3,
        state: 'current',
        hasBudget: false,
        isProvisionable: false,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
      makeMonth({
        month: 4,
        state: 'gap',
        hasBudget: false,
        isProvisionable: false,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
    ]);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    expect(query('goal-plan-current-badge')).toBeTruthy();
    expect(
      fixture.debugElement.queryAll(
        By.css('[data-testid="goal-plan-gap-chip"]'),
      ),
    ).toHaveLength(2);
    expect(query('goal-plan-gap-hint').nativeElement.textContent).toContain(
      '2 mois sans budget',
    );
  });

  it('counts gap rows across the whole plan even when the window hides some of their chips', () => {
    const months: SavingsGoalPlanMonth[] = [
      makeMonth({ month: 1, state: 'past', isLocked: true }),
      makeMonth({ month: 2, state: 'current' }),
      makeMonth({
        month: 3,
        state: 'gap',
        hasBudget: false,
        isProvisionable: false,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
      makeMonth({
        month: 4,
        state: 'gap',
        hasBudget: false,
        isProvisionable: false,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
      makeMonth({
        month: 5,
        state: 'gap',
        hasBudget: false,
        isProvisionable: false,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
      makeMonth({
        month: 6,
        state: 'gap',
        hasBudget: false,
        isProvisionable: false,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
    ];
    setTestInput(fixture.componentInstance.months, months);
    setTestInput(fixture.componentInstance.expanded, false);
    fixture.detectChanges();

    // Collapsed window = last locked (month 1) + 3 open rows → months 1-4,
    // leaving months 5 and 6's chips unrendered.
    expect(rowsQuery().length).toBe(4);
    expect(
      fixture.debugElement.queryAll(
        By.css('[data-testid="goal-plan-gap-chip"]'),
      ),
    ).toHaveLength(2);
    // gapCount reads rows() (the whole plan), not visibleRows() — the
    // announced count stays plan-wide even though only 2 of the 4 gap
    // chips are actually on screen.
    expect(query('goal-plan-gap-hint').nativeElement.textContent).toContain(
      '4 mois sans budget',
    );
  });

  it('never shows an availability chip on a row with a linked forecast', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({ month: 3, state: 'current' }),
    ]);
    fixture.detectChanges();

    expect(query('goal-plan-repair-chip')).toBeFalsy();
    expect(query('goal-plan-no-forecast-chip')).toBeFalsy();
    expect(query('goal-plan-gap-chip')).toBeFalsy();
  });

  it('renders exactly one repair chip per month the recovery banner would repair', () => {
    const months: SavingsGoalPlanMonth[] = [
      makeMonth({
        month: 3,
        state: 'current',
        hasBudget: true,
        isProvisionable: true,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
      makeMonth({
        month: 4,
        state: 'gap',
        hasBudget: true,
        isProvisionable: true,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
      makeMonth({
        month: 5,
        state: 'gap',
        hasBudget: false,
        isProvisionable: false,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
      makeMonth({ month: 6 }),
    ];
    setTestInput(fixture.componentInstance.months, months);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    // Months 3 and 4 carry a budget and are provisionable; month 5 has no
    // budget, month 6 already has a linked line. Stated as a literal count
    // on purpose — recomputing the component's own predicate here would
    // pass whatever that predicate happened to become.
    expect(
      fixture.debugElement.queryAll(
        By.css('[data-testid="goal-plan-repair-chip"]'),
      ),
    ).toHaveLength(2);
  });

  it('starts the monthly plan at the first contribution-eligible month', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({
        month: 7,
        state: 'current',
        isContributionEligible: false,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
      makeMonth({
        month: 8,
        state: 'gap',
        isContributionEligible: false,
        plannedAmount: 0,
        plannedCumulative: 0,
        lines: [],
      }),
      makeMonth({
        month: 9,
        isContributionEligible: true,
        plannedAmount: 1385,
        plannedCumulative: 1385,
      }),
      makeMonth({
        month: 10,
        state: 'gap',
        isContributionEligible: true,
        plannedAmount: 0,
        plannedCumulative: 1385,
        lines: [],
      }),
    ]);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    expect(rowsQuery()).toHaveLength(2);
    expect(
      fixture.debugElement.query(
        By.css(`[data-testid="goal-plan-row-${2026 * 12 + 7}"]`),
      ),
    ).toBeFalsy();
    expect(
      fixture.debugElement.query(
        By.css(`[data-testid="goal-plan-row-${2026 * 12 + 8}"]`),
      ),
    ).toBeFalsy();
    expect(
      fixture.debugElement.queryAll(
        By.css('[data-testid="goal-plan-gap-chip"]'),
      ),
    ).toHaveLength(1);
    expect(query('goal-plan-gap-hint')).toBeTruthy();
  });

  // A withdrawal lands wherever the user spent from the pot — including after
  // the target date, where the month is closed to contributions. Dropping that
  // row leaves the cumulative falling between two lines with nothing on screen
  // to account for it.
  it('keeps a month closed to contributions when it carries a withdrawal', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({ month: 6, plannedAmount: 300, plannedCumulative: 3000 }),
      makeMonth({
        month: 8,
        state: 'gap',
        isContributionEligible: false,
        plannedAmount: 0,
        plannedCumulative: 3000,
        withdrawnAmount: 4500,
        lines: [],
      }),
    ]);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    const withdrawalRow = fixture.debugElement.query(
      By.css(`[data-testid="goal-plan-row-${2026 * 12 + 8}"]`),
    );
    expect(withdrawalRow).toBeTruthy();
    // Aggregation, so no centimes, and signed as the stock exit it is.
    expect(withdrawalRow.nativeElement.textContent).toContain('4’500');
    expect(withdrawalRow.nativeElement.textContent).toContain('Retiré');
  });

  // An announcement takes nothing out yet, so it moves no contribution and no
  // cumulative here — without a sub-line the month says nothing about the 500
  // it plans to release, and the simulator's editable field would look like the
  // place to type it.
  it('states the announced withdrawal of a contributing month without offering to edit it', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({
        month: 8,
        plannedAmount: 450,
        plannedCumulative: 3600,
        plannedWithdrawalAmount: 500,
        remainingPlannedWithdrawalAmount: 500,
        projectedCumulative: 3100,
      }),
    ]);
    setTestInput(fixture.componentInstance.editable, true);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    const announced = query('goal-plan-row-planned-withdrawal');
    expect(announced).toBeTruthy();
    expect(announced.nativeElement.textContent).toContain('Retrait prévu');
    // Signed and aggregated, like every other stock exit on this screen.
    expect(announced.nativeElement.textContent).toContain('-500');
    expect(announced.nativeElement.querySelector('input')).toBeNull();
  });

  // The gross announcement is what the month declares; the part already taken
  // out lives in the confirmed stock. Keeping it gross is what stops the screen
  // from telling the same 500 twice.
  it('keeps announcing the gross amount once the withdrawal is realized', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({
        month: 8,
        plannedWithdrawalAmount: 500,
        remainingPlannedWithdrawalAmount: 0,
        withdrawnAmount: 500,
      }),
    ]);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    expect(
      query('goal-plan-row-planned-withdrawal').nativeElement.textContent,
    ).toContain('-500');
  });

  // Its lines are empty by construction, so the contribution chips would read
  // it as a month whose forecast is missing. Nothing is missing: this month
  // was never meant to contribute.
  it('does not accuse a withdrawal-only month of a missing forecast', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({
        month: 8,
        state: 'gap',
        isContributionEligible: false,
        plannedAmount: 0,
        plannedCumulative: 3000,
        withdrawnAmount: 4500,
        lines: [],
      }),
    ]);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    expect(
      fixture.debugElement.queryAll(
        By.css('[data-testid="goal-plan-gap-chip"]'),
      ),
    ).toHaveLength(0);
    expect(query('goal-plan-gap-hint')).toBeFalsy();
  });

  it('exposes an inline edit affordance only for open months when editable', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({ month: 3, state: 'current' }),
    ]);
    setTestInput(fixture.componentInstance.editable, true);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    const editButton = fixture.debugElement.query(
      By.css('[data-testid^="goal-plan-row-edit-"]'),
    );
    expect(editButton).toBeTruthy();
  });

  function openInlineEdit(plannedAmount = 450): {
    input: HTMLInputElement;
    amounts: { month: number; year: number; amount: number }[];
    invalid: boolean[];
  } {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({ month: 3, year: 2026, state: 'current', plannedAmount }),
    ]);
    setTestInput(fixture.componentInstance.editable, true);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    const amounts: { month: number; year: number; amount: number }[] = [];
    const invalid: boolean[] = [];
    fixture.componentInstance.amountChange.subscribe((event) =>
      amounts.push(event),
    );
    fixture.componentInstance.invalidChange.subscribe((event) =>
      invalid.push(event),
    );

    fixture.debugElement
      .query(By.css('[data-testid^="goal-plan-row-edit-"]'))
      .nativeElement.click();
    fixture.detectChanges();

    return {
      input: query('goal-plan-row-input').nativeElement as HTMLInputElement,
      amounts,
      invalid,
    };
  }

  it('emits amountChange while typing, without waiting for blur', () => {
    const { input, amounts } = openInlineEdit();

    input.value = '600';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(amounts).toEqual([{ month: 3, year: 2026, amount: 600 }]);
    expect(query('goal-plan-row-error')).toBeNull();
  });

  it('accepts a negative monthly movement without an error', () => {
    const { input, amounts, invalid } = openInlineEdit();

    input.value = '-500';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(amounts).toEqual([{ month: 3, year: 2026, amount: -500 }]);
    expect(invalid.at(-1)).toBe(false);
    expect(query('goal-plan-row-error')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.value).toBe('-500');
  });

  it('treats an incomplete entry as pending rather than as an error', () => {
    const { input, amounts, invalid } = openInlineEdit();

    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(amounts).toEqual([]);
    expect(invalid.at(-1)).toBe(true);
    expect(query('goal-plan-row-error')).toBeNull();
  });

  it('keeps a negative monthly movement when the field is left', () => {
    const { input, amounts, invalid } = openInlineEdit();

    input.value = '-500';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(amounts).toEqual([{ month: 3, year: 2026, amount: -500 }]);
    expect(invalid.at(-1)).toBe(false);
    expect(query('goal-plan-row-input')).toBeNull();
  });

  it('windows to the last locked row + 3 open rows when collapsed', () => {
    const months: SavingsGoalPlanMonth[] = [
      makeMonth({ month: 1, state: 'past', isLocked: true }),
      makeMonth({ month: 2, state: 'past', isLocked: true }),
      makeMonth({ month: 3, state: 'current' }),
      makeMonth({ month: 4, state: 'future' }),
      makeMonth({ month: 5, state: 'future' }),
      makeMonth({ month: 6, state: 'future' }),
    ];
    setTestInput(fixture.componentInstance.months, months);
    setTestInput(fixture.componentInstance.expanded, false);
    fixture.detectChanges();

    // last locked (month 2) + 3 following rows (3, 4, 5).
    expect(rowsQuery().length).toBe(4);
    expect(query('goal-plan-see-all')).toBeTruthy();
  });

  it('renders a year divider at the first row and at each year change, not per row', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({ month: 11, year: 2026, plannedCumulative: 450 }),
      makeMonth({ month: 12, year: 2026, plannedCumulative: 900 }),
      makeMonth({ month: 1, year: 2027, plannedCumulative: 1350 }),
      makeMonth({ month: 2, year: 2027, plannedCumulative: 1800 }),
    ]);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    const years = fixture.debugElement
      .queryAll(By.css('[data-testid="goal-plan-year"]'))
      .map((el) => el.nativeElement.textContent.trim());
    // 2026 once (first row) + 2027 once (year change) — a multi-year plan is
    // readable without repeating the year on all four rows.
    expect(years).toEqual(['2026', '2027']);
  });
});
