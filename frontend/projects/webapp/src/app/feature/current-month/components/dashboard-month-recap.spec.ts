import { TestBed } from '@angular/core/testing';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { DashboardMonthRecap } from './dashboard-month-recap';
import type { MonthRecap } from '../services/dashboard-state';

registerLocaleData(localeDE);

const april: MonthRecap = {
  budgetId: 'budget-april',
  month: 4,
  year: 2026,
  income: 5000,
  expenses: 4700,
  endingBalance: 300,
  outcome: 'saved',
  carriedOver: 300,
  startingAvailable: 5300,
};

describe('DashboardMonthRecap', () => {
  async function render(recap: MonthRecap) {
    await TestBed.configureTestingModule({
      imports: [DashboardMonthRecap],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: LOCALE_ID, useValue: 'fr-CH' },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardMonthRecap);
    fixture.componentRef.setInput('recap', recap);
    await fixture.whenStable();
    return { fixture, text: () => fixture.nativeElement.textContent as string };
  }

  it('should name the closed month without a preposition to elide', async () => {
    const { text } = await render(april);

    expect(text()).toContain('Avril est terminé');
  });

  it.each([
    [april, 'Bien joué, tu as mis 300 CHF de côté.'],
    [
      { ...april, endingBalance: -120, outcome: 'overspent' as const },
      'Ça arrive : 120 CHF de plus que prévu.',
    ],
    [
      { ...april, endingBalance: 0.3, outcome: 'balanced' as const },
      'Budget respecté.',
    ],
  ])('should word the %# outcome without blame', async (recap, sentence) => {
    const { text } = await render(recap);

    expect(text().replace(/\s+/g, ' ')).toContain(sentence);
  });

  it('should ask to open the detail and to be dismissed', async () => {
    const { fixture } = await render(april);
    const opened = vi.fn();
    const dismissed = vi.fn();
    fixture.componentInstance.openDetails.subscribe(opened);
    fixture.componentInstance.dismiss.subscribe(dismissed);
    const host: HTMLElement = fixture.nativeElement;

    host
      .querySelector<HTMLButtonElement>(
        '[data-testid="month-recap-open-button"]',
      )
      ?.click();
    host
      .querySelector<HTMLButtonElement>(
        '[data-testid="month-recap-dismiss-button"]',
      )
      ?.click();

    expect(opened).toHaveBeenCalledTimes(1);
    expect(dismissed).toHaveBeenCalledTimes(1);
  });
});
