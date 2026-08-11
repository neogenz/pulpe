import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DashboardNextMonth } from './dashboard-next-month';
import type { UpcomingMonthForecast } from '../services/dashboard-state';
import { setTestInput } from '../../../testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';

registerLocaleData(localeDE);

const mockForecastWithBudget: UpcomingMonthForecast = {
  month: 3,
  year: 2026,
  hasBudget: true,
  income: 5000,
  expenses: 3500,
  savings: 500,
};

const mockForecastWithoutBudget: UpcomingMonthForecast = {
  month: 3,
  year: 2026,
  hasBudget: false,
  income: null,
  expenses: null,
  savings: null,
};

describe('DashboardNextMonth', () => {
  let component: DashboardNextMonth;
  let fixture: ComponentFixture<DashboardNextMonth>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardNextMonth],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: LOCALE_ID, useValue: 'fr-CH' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardNextMonth);
    component = fixture.componentInstance;
    setTestInput(component.forecast, mockForecastWithBudget);
    setTestInput(component.estimatedRollover, 0);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('with budget', () => {
    beforeEach(() => {
      setTestInput(component.forecast, mockForecastWithBudget);
      setTestInput(component.estimatedRollover, 200);
      fixture.detectChanges();
    });

    it('should display rollover info', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('report estimé');
      expect(text).toContain('200');
    });

    it('should show month name', () => {
      expect(fixture.nativeElement.textContent).toContain('mars');
      expect(fixture.nativeElement.textContent).toContain('2026');
    });
  });

  // The upcoming-budgets list is filled unconditionally, so a dead history
  // request reaches this card as twelve months of hasBudget:false and used to
  // come out as "Pas encore de budget pour mars" — a user invited to plan a
  // month he had already planned, next to a chart correctly saying it could
  // not load.
  describe('when the request failed', () => {
    beforeEach(() => {
      setTestInput(component.forecast, mockForecastWithoutBudget);
      setTestInput(component.estimatedRollover, 0);
      setTestInput(component.hasError, true);
      fixture.detectChanges();
    });

    it('should say it could not load instead of offering to plan the month', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain("On n'arrive pas à voir le mois prochain");
      expect(text).not.toContain('Anticiper le mois prochain');
    });

    it('should offer a retry in place', () => {
      let retried = false;
      component.retry.subscribe(() => (retried = true));

      fixture.nativeElement
        .querySelector('[data-testid="next-month-retry"]')
        .click();

      expect(retried).toBe(true);
    });
  });

  describe('without budget', () => {
    beforeEach(() => {
      setTestInput(component.forecast, mockForecastWithoutBudget);
      setTestInput(component.estimatedRollover, 0);
      fixture.detectChanges();
    });

    it('should show CTA button', () => {
      expect(fixture.nativeElement.textContent).toContain(
        'Anticiper le mois prochain',
      );
    });

    it('should emit navigateToBudgets on CTA click', () => {
      let emitted = false;
      component.navigateToBudgets.subscribe(() => (emitted = true));

      const button = fixture.debugElement.query(By.css('button'));
      button.nativeElement.click();

      expect(emitted).toBe(true);
    });
  });
});
