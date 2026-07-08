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

  it('lists one row per contribution with a 2-decimal amount', () => {
    setTestInput(fixture.componentInstance.contributions, [
      makeContribution({ checkedAt: '2026-07-02T18:00:00.000Z' }),
      makeContribution({ lineId: 'line-2', budgetMonth: 8 }),
    ]);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(
      By.css('[data-testid="savings-goal-contribution-row"]'),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].nativeElement.textContent).toContain('Épargne mensuelle');
    expect(rows[0].nativeElement.textContent).toContain('500.00');
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
            category: null,
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
