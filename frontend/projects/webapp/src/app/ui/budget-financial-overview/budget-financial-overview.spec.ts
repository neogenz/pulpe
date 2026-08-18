import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import localeFR from '@angular/common/locales/fr';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { FinancialPills } from '../financial-pills/financial-pills';
import {
  BudgetFinancialOverview,
  type FinancialTotals,
} from './budget-financial-overview';

registerLocaleData(localeDE);
registerLocaleData(localeFR);

const COMFORTABLE_TOTALS: FinancialTotals = {
  income: 5000,
  expenses: 2000,
  savings: 500,
  remaining: 2500,
};

const WARNING_TOTALS: FinancialTotals = {
  income: 5000,
  expenses: 4700,
  savings: 0,
  remaining: 300,
};

const DEFICIT_TOTALS: FinancialTotals = {
  income: 5000,
  expenses: 5700,
  savings: 0,
  remaining: -700,
};

describe('BudgetFinancialOverview', () => {
  let fixture: ComponentFixture<BudgetFinancialOverview>;

  const renderWithRollover = (rollover: number): string | null => {
    setTestInput(fixture.componentInstance.rollover, rollover);
    fixture.detectChanges();

    return (
      fixture.nativeElement
        .querySelector('[data-testid="financial-overview-rollover"]')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim() ?? null
    );
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetFinancialOverview],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    })
      .overrideComponent(FinancialPills, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(BudgetFinancialOverview);
    setTestInput(fixture.componentInstance.totals, COMFORTABLE_TOTALS);
  });

  describe('rollover disclosure', () => {
    it('should disclose a positive rollover baked into the remaining amount', () => {
      expect(renderWithRollover(177)).toContain('+177');
    });

    it('should disclose a negative rollover with a minus sign', () => {
      expect(renderWithRollover(-240)).toContain('−240');
    });

    it('should stay hidden when there is no rollover to disclose', () => {
      expect(renderWithRollover(0)).toBeNull();
    });

    it('should stay hidden when a residual rollover rounds to zero', () => {
      expect(renderWithRollover(0.3)).toBeNull();
      expect(renderWithRollover(-0.4)).toBeNull();
    });

    it('should round the aria-label amount to match the visible figure', () => {
      setTestInput(fixture.componentInstance.rollover, 3800.75);
      fixture.detectChanges();

      const label =
        (
          fixture.nativeElement.querySelector(
            '[data-testid="financial-overview-rollover"]',
          ) as HTMLElement
        ).getAttribute('aria-label') ?? '';
      const digits = label.replace(/[\s'’]/g, '');

      expect(digits).toContain('3801');
      expect(digits).not.toContain('3800.75');
      expect(label).toContain('CHF');
    });

    it('should carry the colour of the budget state it sits on', () => {
      const classesFor = (totals: FinancialTotals): string => {
        setTestInput(fixture.componentInstance.totals, totals);
        renderWithRollover(177);

        return (
          fixture.nativeElement.querySelector(
            '[data-testid="financial-overview-rollover"]',
          ) as HTMLElement
        ).className;
      };

      expect(classesFor(COMFORTABLE_TOTALS)).toContain(
        'text-on-primary-container',
      );
      expect(classesFor(WARNING_TOTALS)).toContain('text-warning-on-container');
      expect(classesFor(DEFICIT_TOTALS)).toContain('text-on-error-container');
    });
  });

  describe('deficit recovery action', () => {
    beforeEach(() => {
      setTestInput(fixture.componentInstance.totals, DEFICIT_TOTALS);
      setTestInput(fixture.componentInstance.showSavingsAction, true);
      fixture.detectChanges();
    });

    it('should keep the deficit amount centred with concise recovery copy', () => {
      const hero: HTMLElement =
        fixture.nativeElement.querySelector('.overview-hero');

      expect(hero.className).toContain('text-center');
      expect(hero.textContent).not.toContain('selon tes prévisions');
      expect(hero.textContent).toContain(
        'Couvre ce déficit avec ton épargne, puis reconstitue-la le mois prochain.',
      );
    });

    it('should keep the savings action functional', () => {
      const cover = vi.spyOn(
        fixture.componentInstance.coverWithSavings,
        'emit',
      );

      fixture.nativeElement
        .querySelector('[data-testid="financial-overview-cover-with-savings"]')
        .click();

      expect(cover).toHaveBeenCalledOnce();
    });

    it('should hide the savings action when the page gate is closed', () => {
      setTestInput(fixture.componentInstance.showSavingsAction, false);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="financial-overview-cover-with-savings"]',
        ),
      ).toBeNull();
    });
  });

  describe('cent-level state', () => {
    it('ignores binary dust instead of announcing a zero deficit', () => {
      setTestInput(fixture.componentInstance.totals, {
        ...COMFORTABLE_TOTALS,
        remaining: -9e-13,
      });
      fixture.detectChanges();

      expect(fixture.componentInstance.budgetState()).toBe('warning');
      expect(fixture.nativeElement.textContent).not.toContain('Déficit');
    });

    it('shows a real cent in CHF and keeps an integer compact', () => {
      setTestInput(fixture.componentInstance.totals, {
        ...DEFICIT_TOTALS,
        remaining: -0.01,
      });
      fixture.detectChanges();

      expect(fixture.componentInstance.budgetState()).toBe('deficit');
      expect(fixture.nativeElement.textContent).toContain('0.01');

      setTestInput(fixture.componentInstance.totals, {
        ...COMFORTABLE_TOTALS,
        remaining: 5000,
      });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('5000.00');
    });

    it('localizes a one-cent EUR deficit with a comma', () => {
      setTestInput(fixture.componentInstance.currency, 'EUR');
      setTestInput(fixture.componentInstance.locale, 'fr-FR');
      setTestInput(fixture.componentInstance.totals, {
        ...DEFICIT_TOTALS,
        remaining: -0.01,
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('0,01');
      expect(fixture.nativeElement.textContent).toContain('€');
    });
  });
});
