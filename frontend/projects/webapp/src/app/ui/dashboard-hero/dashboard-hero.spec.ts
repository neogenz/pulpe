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

  it('should call the month over budget once more has gone out than came in', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 1200);
    setTestInput(component.remaining, -200);
    setTestInput(component.budgetConsumedPercentage, 100);
    setTestInput(component.realizedExpenses, 1100);

    expect(component.isOverBudget()).toBe(true);
    expect(component.isWarning()).toBe(false);
    expect(component.budgetStatus()).toBe('over-budget');
  });

  it('should warn on the pace, not on the plan', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 950);
    setTestInput(component.remaining, 50);
    setTestInput(component.budgetConsumedPercentage, 95);
    setTestInput(component.realizedExpenses, 300);
    setTestInput(component.paceStatus, 'tight');

    expect(component.isOverBudget()).toBe(false);
    expect(component.isWarning()).toBe(true);
  });

  // The card used to be amber for anyone who committed more than 90% of their
  // income to a plan, which is every month a disciplined saver has. The colour
  // is read off the ledger now; the plan stays in the legend.
  it('should stay calm on a tight plan the user is respecting', () => {
    setTestInput(component.available, 5000);
    setTestInput(component.expenses, 4700);
    setTestInput(component.remaining, 300);
    setTestInput(component.budgetConsumedPercentage, 94);
    setTestInput(component.realizedExpenses, 900);
    setTestInput(component.paceStatus, 'on-track');

    expect(component.isWarning()).toBe(false);
    expect(component.isOverBudget()).toBe(false);
    expect(component.budgetStatus()).toBe('on-track');
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

    // The reverse of the order this card shipped with. "Presque entièrement
    // engagé" is read off a plan that exists whether or not anything has
    // happened, so it was printed every day of every month and this sentence —
    // the only one about what the user actually did — was never reached.
    it('should let the pace verdict outrank a merely tight plan', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 950);
      setTestInput(component.remaining, 50);
      setTestInput(component.budgetConsumedPercentage, 95);
      setTestInput(component.realizedExpenses, 400);
      setTestInput(component.paceStatus, 'tight');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('plus vite que le mois');
      expect(compiled.textContent).not.toContain('entièrement engagé');
    });

    // With nothing recorded the pace cannot speak, and the plan is then the one
    // true thing the card has to say.
    it('should fall back to the plan when the ledger is still empty', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 950);
      setTestInput(component.remaining, 50);
      setTestInput(component.budgetConsumedPercentage, 95);
      setTestInput(component.realizedExpenses, 0);
      setTestInput(component.paceStatus, 'unknown');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('entièrement engagé');
    });

    // A plan larger than the month's income plus its report. A negative report
    // alone is enough to land here, so it is not an exotic state — it was
    // simply one the card could not reach: it printed the negative at 57px on
    // the calm gradient, captioned "disponible à dépenser", beside a sentence
    // hedging that the budget was "presque" entirely committed.
    it('should not stay calm on a plan that asks for more than the month has', () => {
      setTestInput(component.available, 4000);
      setTestInput(component.expenses, 4500);
      setTestInput(component.remaining, -500);
      setTestInput(component.budgetConsumedPercentage, 100);
      setTestInput(component.realizedExpenses, 900);
      setTestInput(component.paceStatus, 'on-track');
      fixture.detectChanges();

      expect(component.isOverBudget()).toBe(false);
      expect(component.isWarning()).toBe(true);
      expect(component.budgetStatus()).toBe('warning');
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('plus que ce que le mois');
      expect(compiled.textContent).not.toContain('presque');
      // The caption follows the sign, and takes the ceiling with it: a
      // shortfall does not come out of a budget of 4'000.
      expect(compiled.textContent).toContain('Il manque');
      expect(compiled.textContent).not.toContain('Disponible à dépenser');
    });

    it('should say the month went over once spending passed what came in', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 1200);
      setTestInput(component.remaining, -200);
      setTestInput(component.realizedExpenses, 1100);
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
