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

  it('badges the current month and shows the « Pas de budget » chip for gaps', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({ month: 3, state: 'current' }),
      makeMonth({
        month: 4,
        state: 'gap',
        plannedAmount: 0,
        plannedCumulative: 900,
        lines: [],
      }),
    ]);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    expect(query('goal-plan-current-badge')).toBeTruthy();
    expect(query('goal-plan-gap-chip')).toBeTruthy();
    expect(query('goal-plan-gap-hint')).toBeTruthy();
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

  it('emits amountChange when an inline edit is committed', () => {
    setTestInput(fixture.componentInstance.months, [
      makeMonth({ month: 3, year: 2026, state: 'current', plannedAmount: 450 }),
    ]);
    setTestInput(fixture.componentInstance.editable, true);
    setTestInput(fixture.componentInstance.expanded, true);
    fixture.detectChanges();

    const emitted: { month: number; year: number; amount: number }[] = [];
    fixture.componentInstance.amountChange.subscribe((event) =>
      emitted.push(event),
    );

    const editButton = fixture.debugElement.query(
      By.css('[data-testid^="goal-plan-row-edit-"]'),
    );
    editButton.nativeElement.click();
    fixture.detectChanges();

    const input = query('goal-plan-row-input')
      .nativeElement as HTMLInputElement;
    input.value = '600';
    input.dispatchEvent(new Event('blur'));

    expect(emitted).toEqual([{ month: 3, year: 2026, amount: 600 }]);
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
