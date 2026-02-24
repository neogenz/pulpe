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
    setTestInput(component.totalIncome, 0);
    setTestInput(component.periodDates, {
      startDate: new Date(),
      endDate: new Date(),
    });
  });

  it('should compute remaining correctly', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 400);
    setTestInput(component.periodDates, {
      startDate: new Date(),
      endDate: new Date(),
    });

    expect(component.remaining()).toBe(600);
  });

  it('should determine isOverBudget', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 1200);
    setTestInput(component.periodDates, {
      startDate: new Date(),
      endDate: new Date(),
    });

    expect(component.isOverBudget()).toBe(true);
    expect(component.isWarning()).toBe(false);
    expect(component.isOnTrack()).toBe(false);
  });

  it('should determine isWarning (>80% consumed)', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 850);
    setTestInput(component.periodDates, {
      startDate: new Date(),
      endDate: new Date(),
    });

    expect(component.isOverBudget()).toBe(false);
    expect(component.isWarning()).toBe(true);
    expect(component.budgetConsumedPercentage()).toBe(85);
  });

  it('should compute budgetConsumedPercentage clamped to 100', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 1200);
    setTestInput(component.periodDates, {
      startDate: new Date(),
      endDate: new Date(),
    });

    expect(component.budgetConsumedPercentage()).toBe(100);
  });

  it('should compute timeElapsedPercentage', () => {
    const start = new Date();
    start.setDate(start.getDate() - 15);

    const end = new Date(start);
    end.setDate(end.getDate() + 30); // 30 days total period

    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 0);
    setTestInput(component.periodDates, {
      startDate: start,
      endDate: end,
    });

    // Elapsed should be ~15 days out of 30, roughly 50%

    // Because we use current date inside the component.timeElapsedPercentage,
    // and setting hours to 23:59:59 modifies things slightly, we allow a small delta.
    expect(component.timeElapsedPercentage()).toBeGreaterThanOrEqual(49);
    expect(component.timeElapsedPercentage()).toBeLessThanOrEqual(55);
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

    it('should show negative rollover with minus sign', () => {
      setTestInput(component.available, 4500);
      setTestInput(component.expenses, 1000);
      setTestInput(component.totalIncome, 5000);
      setTestInput(component.rolloverAmount, -500);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('- Report');
    });
  });

  describe('pace indicator', () => {
    it('should return on-track when consumed <= elapsed + 5', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 400);

      const start = new Date();
      start.setDate(start.getDate() - 15);
      const end = new Date(start);
      end.setDate(end.getDate() + 30);

      setTestInput(component.periodDates, {
        startDate: start,
        endDate: end,
      });

      // ~50% elapsed, 40% consumed => on-track
      expect(component.paceStatus()).toBe('on-track');
    });

    it('should return tight when consumed > elapsed + 5', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 900);

      const start = new Date();
      start.setDate(start.getDate() - 15);
      const end = new Date(start);
      end.setDate(end.getDate() + 30);

      setTestInput(component.periodDates, {
        startDate: start,
        endDate: end,
      });

      // ~50% elapsed, 90% consumed => tight
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
