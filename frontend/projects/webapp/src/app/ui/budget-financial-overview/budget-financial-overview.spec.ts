import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { FinancialPills } from '../financial-pills/financial-pills';
import {
  BudgetFinancialOverview,
  type FinancialTotals,
} from './budget-financial-overview';

registerLocaleData(localeDE);

const COMFORTABLE_TOTALS: FinancialTotals = {
  income: 5000,
  expenses: 2000,
  savings: 500,
  remaining: 2500,
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
  });
});
