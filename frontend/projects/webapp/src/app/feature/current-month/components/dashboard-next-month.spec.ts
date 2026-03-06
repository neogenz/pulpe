import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DashboardNextMonth } from './dashboard-next-month';
import type { UpcomingMonthForecast } from '../services/dashboard-state';
import { setTestInput } from '../../../testing/signal-test-utils';
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
