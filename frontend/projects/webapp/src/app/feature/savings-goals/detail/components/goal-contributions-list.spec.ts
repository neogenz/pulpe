import { describe, it, expect, beforeEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import type { SavingsGoalContribution } from 'pulpe-shared';
import { GoalContributionsList } from './goal-contributions-list';
import { setTestInput } from '../../../../testing/signal-test-utils';
import { provideTranslocoForTest } from '../../../../testing/transloco-testing';

registerLocaleData(localeDE);

function makeContribution(
  overrides: Partial<SavingsGoalContribution> = {},
): SavingsGoalContribution {
  return {
    lineId: 'line-1',
    name: 'Épargne mensuelle',
    amount: 500,
    checkedAt: null,
    budgetMonth: 7,
    budgetYear: 2026,
    transactions: [],
    ...overrides,
  };
}

describe('GoalContributionsList', () => {
  let fixture: ComponentFixture<GoalContributionsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalContributionsList],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoalContributionsList);
    setTestInput(fixture.componentInstance.currency, 'CHF');
  });

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }

  it('renders realised rows with a 2-decimal amount and promotes the next month to a callout', () => {
    setTestInput(fixture.componentInstance.contributions, [
      makeContribution({ checkedAt: '2026-07-02T18:00:00.000Z' }), // July pointée
      makeContribution({ lineId: 'line-2', budgetMonth: 8 }), // Aug à pointer → callout
    ]);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(
      By.css('[data-testid="savings-goal-contribution-row"]'),
    );
    // Only the pointée is a ledger row; the next month lives in the callout.
    expect(rows).toHaveLength(1);
    expect(rows[0].nativeElement.textContent).toContain('Épargne mensuelle');
    expect(rows[0].nativeElement.textContent).toContain('500.00');
    // The one forward action is surfaced as the savings-tinted callout.
    const next = query('goal-contribution-next');
    expect(next).toBeTruthy();
    expect(next.nativeElement.textContent).toContain('500.00');
    expect(
      next.nativeElement.querySelector('mat-icon').textContent.trim(),
    ).toBe('event_upcoming');
  });

  it('collapses future months to activity + a next callout with a positive headline, then expands', () => {
    setTestInput(fixture.componentInstance.contributions, [
      makeContribution({
        lineId: 'l1',
        budgetMonth: 6,
        checkedAt: '2026-06-02T18:00:00.000Z',
      }),
      makeContribution({ lineId: 'l2', budgetMonth: 7 }), // next à pointer → callout
      makeContribution({ lineId: 'l3', budgetMonth: 8 }),
      makeContribution({ lineId: 'l4', budgetMonth: 9 }),
      makeContribution({ lineId: 'l5', budgetMonth: 10 }),
    ]);
    fixture.detectChanges();

    const rows = () =>
      fixture.debugElement.queryAll(
        By.css('[data-testid="savings-goal-contribution-row"]'),
      );
    // Collapsed: only the activity (June pointée) is a row; the next month is
    // the callout; the identical future months are hidden.
    expect(rows()).toHaveLength(1);
    expect(query('goal-contribution-next')).toBeTruthy();
    // Positive headline — no « à pointer » backlog count.
    const summary = query('goal-contributions-summary').nativeElement
      .textContent;
    expect(summary).toContain('1');
    expect(summary.toLowerCase()).toContain('mis de côté');
    expect(summary).not.toContain('À pointer');

    // « Voir tout » reveals the full ledger.
    query('goal-contributions-see-all').nativeElement.click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(5);
    expect(
      rows()[1].nativeElement.querySelector('mat-icon').textContent.trim(),
    ).toBe('schedule');
  });

  it('nests the allocated transactions under their contribution', () => {
    setTestInput(fixture.componentInstance.contributions, [
      makeContribution({
        transactions: [
          {
            id: 'tx-1',
            budgetId: 'budget-1',
            budgetLineId: 'line-1',
            name: 'macbook1',
            amount: 150,
            kind: 'saving',
            transactionDate: '2026-07-02T10:00:00.000Z',
            checkedAt: '2026-07-02T10:00:00.000Z',
            createdAt: '2026-07-02T10:00:00.000Z',
            updatedAt: '2026-07-02T10:00:00.000Z',
            originalAmount: null,
            originalCurrency: null,
            targetCurrency: null,
            exchangeRate: null,
          },
        ],
      }),
    ]);
    fixture.detectChanges();

    const nested = fixture.debugElement.queryAll(
      By.css('[data-testid="savings-goal-contribution-transaction"]'),
    );
    expect(nested).toHaveLength(1);
    expect(nested[0].nativeElement.textContent).toContain('macbook1');
    expect(nested[0].nativeElement.textContent).toContain('150.00');
    // The inset block is labeled « Réel » so the envelope/transaction
    // relationship reads at a glance.
    const row = query('savings-goal-contribution-row');
    expect(row.nativeElement.textContent).toContain('Réel');
  });
});
