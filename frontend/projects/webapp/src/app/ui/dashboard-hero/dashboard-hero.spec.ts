import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DashboardHero } from './dashboard-hero';
import { setTestInput } from '@app/testing/signal-test-utils';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

registerLocaleData(localeDE);

describe('DashboardHero', () => {
  let component: DashboardHero;
  let fixture: ComponentFixture<DashboardHero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardHero],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardHero);
    component = fixture.componentInstance;

    setTestInput(component.available, 0);
    setTestInput(component.expenses, 0);
    setTestInput(component.remaining, 0);
    setTestInput(component.budgetConsumedPercentage, 0);
    setTestInput(component.realizedExpenses, 0);
    setTestInput(component.realizedPercentage, 0);
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

  describe('progress legend', () => {
    it('should name the untouched segment with the remaining amount', () => {
      setTestInput(component.available, 4800);
      setTestInput(component.expenses, 3491);
      setTestInput(component.remaining, 1309);
      setTestInput(component.budgetConsumedPercentage, 73);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const freeKey = compiled.querySelector('.swatch-free')?.parentElement;
      expect(freeKey?.textContent).toContain('Disponible');
      expect(freeKey?.textContent).toMatch(/1.309/);
    });

    it('should drop the untouched key once the budget is fully consumed', () => {
      setTestInput(component.available, 4800);
      setTestInput(component.expenses, 4800);
      setTestInput(component.remaining, 0);
      setTestInput(component.budgetConsumedPercentage, 100);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.segment-free')).toBeNull();
      expect(compiled.querySelector('.swatch-free')).toBeNull();
    });
  });

  describe('rollover decomposition', () => {
    it('should caption the amount with its label', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 1000);
      setTestInput(component.rolloverAmount, 500);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Disponible');
      expect(compiled.textContent).toContain('Report');
    });

    it('should hide rollover when rolloverAmount is 0', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 1000);
      setTestInput(component.rolloverAmount, 0);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Disponible');
      expect(compiled.textContent).not.toContain('Report');
    });

    it('should show negative rollover with minus sign attached to number', () => {
      setTestInput(component.available, 4500);
      setTestInput(component.expenses, 1000);
      setTestInput(component.rolloverAmount, -500);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const text = compiled.textContent!;
      expect(text).toContain('Report du mois dernier');
      expect(text).not.toContain('- Report');
      expect(text).toMatch(/Report du mois dernier\s*[−-]500/);
    });

    it('should show positive rollover with plus sign', () => {
      setTestInput(component.available, 5500);
      setTestInput(component.expenses, 1000);
      setTestInput(component.rolloverAmount, 500);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const text = compiled.textContent!;
      expect(text).toMatch(/Report du mois dernier\s*\+/);
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

    it('should render the pace verdict when spending outruns the month', () => {
      setTestInput(component.paceStatus, 'tight');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('plus vite que le mois');
    });

    it('should let the budget verdict outrank the pace verdict', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 1200);
      setTestInput(component.remaining, -200);
      setTestInput(component.paceStatus, 'tight');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('au-delà de ton budget');
      expect(compiled.textContent).not.toContain('plus vite que le mois');
    });
  });

  describe('heroClick output', () => {
    it('should emit heroClick when the open-month control is clicked', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 400);
      fixture.detectChanges();

      let emitted = false;
      component.heroClick.subscribe(() => (emitted = true));

      const action = fixture.nativeElement.querySelector('.hero-action');
      action.click();

      expect(emitted).toBe(true);
    });

    // The control covers the card, and only reaches that far because it is a
    // direct child of it: an absolute box resolves against its nearest
    // positioned ancestor, and every content row here is relative z-10. Parked
    // inside one — where it first shipped — it covered that row and nothing
    // else, and the whole-card tap the card has always had was quietly gone.
    it('should mount the control as a direct child of the card', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 400);
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.hero-container');
      const action = fixture.nativeElement.querySelector('.hero-action');

      expect(action.parentElement).toBe(container);
    });
  });

  describe('accessibility tree', () => {
    it('should keep the month heading and the engaged hint readable', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 400);
      fixture.detectChanges();

      // The card used to be a role="button", and ARIA prunes the roles and
      // names of a button's descendants: this heading and this paragraph were
      // both in the DOM and both invisible to a screen reader.
      const container = fixture.nativeElement.querySelector('.hero-container');
      const heading = fixture.nativeElement.querySelector('h2');

      expect(container.getAttribute('role')).toBeNull();
      expect(container.getAttribute('aria-labelledby')).toBe(heading.id);
      expect(
        fixture.nativeElement.querySelector('.progress-legend-note'),
      ).not.toBeNull();
    });
  });
});
