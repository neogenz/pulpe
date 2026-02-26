import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DashboardHero } from './dashboard-hero';
import { setTestInput } from '../../../testing/signal-test-utils';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';

registerLocaleData(localeDE);

describe('DashboardHero', () => {
  let component: DashboardHero;
  let fixture: ComponentFixture<DashboardHero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardHero],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardHero);
    component = fixture.componentInstance;

    setTestInput(component.available, 0);
    setTestInput(component.expenses, 0);
    setTestInput(component.remaining, 0);
    setTestInput(component.budgetConsumedPercentage, 0);
    setTestInput(component.totalIncome, 0);
    setTestInput(component.periodDates, {
      startDate: new Date(),
      endDate: new Date(),
    });
    setTestInput(component.timeElapsedPercentage, 50);
    setTestInput(component.paceStatus, 'on-track');
  });

  it('should expose remaining from input', () => {
    setTestInput(component.remaining, 600);

    expect(component.remaining()).toBe(600);
  });

  it('should determine isOverBudget', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 1200);
    setTestInput(component.remaining, -200);
    setTestInput(component.budgetConsumedPercentage, 100);
    setTestInput(component.periodDates, {
      startDate: new Date(),
      endDate: new Date(),
    });

    expect(component.isOverBudget()).toBe(true);
    expect(component.isWarning()).toBe(false);
    expect(component.budgetStatus()).toBe('over-budget');
  });

  it('should determine isWarning (>90% consumed)', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 950);
    setTestInput(component.remaining, 50);
    setTestInput(component.budgetConsumedPercentage, 95);
    setTestInput(component.periodDates, {
      startDate: new Date(),
      endDate: new Date(),
    });

    expect(component.isOverBudget()).toBe(false);
    expect(component.isWarning()).toBe(true);
    expect(component.budgetConsumedPercentage()).toBe(95);
  });

  it('should expose budgetConsumedPercentage from input', () => {
    setTestInput(component.budgetConsumedPercentage, 100);

    expect(component.budgetConsumedPercentage()).toBe(100);
  });

  it('should expose timeElapsedPercentage from input', () => {
    setTestInput(component.timeElapsedPercentage, 75);

    expect(component.timeElapsedPercentage()).toBe(75);
  });

  describe('rollover decomposition', () => {
    it('should render totalIncome in the decomposition line', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 1000);
      setTestInput(component.totalIncome, 4500);
      setTestInput(component.rolloverAmount, 500);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Revenus');
      expect(compiled.textContent).toContain('Report');
    });

    it('should hide rollover when rolloverAmount is 0', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 1000);
      setTestInput(component.totalIncome, 5000);
      setTestInput(component.rolloverAmount, 0);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Revenus');
      expect(compiled.textContent).not.toContain('Report');
    });

    it('should show negative rollover with minus sign attached to number', () => {
      setTestInput(component.available, 4500);
      setTestInput(component.expenses, 1000);
      setTestInput(component.totalIncome, 5000);
      setTestInput(component.rolloverAmount, -500);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const text = compiled.textContent!;
      expect(text).toContain('Report');
      expect(text).not.toContain('- Report');
      expect(text).toMatch(/Report\s*[−-]500/);
    });

    it('should show positive rollover with plus sign', () => {
      setTestInput(component.available, 5500);
      setTestInput(component.expenses, 1000);
      setTestInput(component.totalIncome, 5000);
      setTestInput(component.rolloverAmount, 500);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const text = compiled.textContent!;
      expect(text).toMatch(/Report\s*\+/);
    });
  });

  describe('pace indicator', () => {
    it('should expose paceStatus from input as on-track', () => {
      setTestInput(component.paceStatus, 'on-track');

      expect(component.paceStatus()).toBe('on-track');
    });

    it('should expose paceStatus from input as tight', () => {
      setTestInput(component.paceStatus, 'tight');

      expect(component.paceStatus()).toBe('tight');
    });
  });

  describe('heroClick output', () => {
    it('should emit heroClick when container is clicked', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 400);
      setTestInput(component.totalIncome, 1000);
      fixture.detectChanges();

      let emitted = false;
      component.heroClick.subscribe(() => (emitted = true));

      const container = fixture.nativeElement.querySelector('.hero-container');
      container.click();

      expect(emitted).toBe(true);
    });
  });
});
