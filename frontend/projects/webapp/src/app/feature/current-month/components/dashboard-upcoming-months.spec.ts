import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardUpcomingMonths } from './dashboard-upcoming-months';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import { setTestInput } from '../../../testing/signal-test-utils';
registerLocaleData(localeDE);

describe('DashboardUpcomingMonths', () => {
  let component: DashboardUpcomingMonths;
  let fixture: ComponentFixture<DashboardUpcomingMonths>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DashboardUpcomingMonths],
    });
    fixture = TestBed.createComponent(DashboardUpcomingMonths);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setTestInput(component.forecasts, []);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('ควrender future budgets with and without setup properly', () => {
    setTestInput(component.forecasts, [
      {
        month: 11,
        year: 2024,
        hasBudget: true,
        income: 2500,
        expenses: -1000,
      },
      {
        month: 12,
        year: 2024,
        hasBudget: false,
        income: null,
        expenses: null,
      },
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('novembre 2024');
    expect(compiled.textContent).toContain('2’500.00 CHF'); // de-CH format
    expect(compiled.textContent).toContain('décembre 2024');
    expect(compiled.textContent).toContain('Pas encore de budget');
  });
});
