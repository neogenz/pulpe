import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { FinancialPills, type FinancialPillsTotals } from './financial-pills';

describe('FinancialPills', () => {
  let fixture: ComponentFixture<FinancialPills>;
  let component: FinancialPills;

  const totals: FinancialPillsTotals = {
    income: 5000,
    expenses: 1500,
    savings: 300,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancialPills],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FinancialPills);
    component = fixture.componentInstance;
  });

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should default currency to CHF', () => {
      expect(component.currency()).toBe('CHF');
    });

    it('should default locale to de-CH', () => {
      expect(component.locale()).toBe('de-CH');
    });
  });

  describe('Rendering', () => {
    it('should render the three pills with their expected testIds', () => {
      setTestInput(component.totals, totals);
      fixture.detectChanges();

      const root: HTMLElement = fixture.nativeElement;
      expect(root.querySelector('[data-testid="income-pill"]')).toBeTruthy();
      expect(root.querySelector('[data-testid="expense-pill"]')).toBeTruthy();
      expect(root.querySelector('[data-testid="savings-pill"]')).toBeTruthy();
    });

    it('should expose the localized aria-label on the list', () => {
      setTestInput(component.totals, totals);
      fixture.detectChanges();

      const list: HTMLElement =
        fixture.nativeElement.querySelector('[role="list"]');
      expect(list).toBeTruthy();
      expect(list.getAttribute('aria-label')).toBe('Résumé financier');
    });

    it('should display each amount followed by the currency', () => {
      setTestInput(component.totals, totals);
      fixture.detectChanges();

      const incomePill: HTMLElement = fixture.nativeElement.querySelector(
        '[data-testid="income-pill"]',
      );
      const expensePill: HTMLElement = fixture.nativeElement.querySelector(
        '[data-testid="expense-pill"]',
      );
      const savingsPill: HTMLElement = fixture.nativeElement.querySelector(
        '[data-testid="savings-pill"]',
      );

      expect(incomePill.textContent).toContain('CHF');
      expect(expensePill.textContent).toContain('CHF');
      expect(savingsPill.textContent).toContain('CHF');
      expect(incomePill.textContent).not.toContain('EUR');
      expect(incomePill.textContent).toMatch(/5[’'\s]?000/);
      expect(expensePill.textContent).toMatch(/1[’'\s]?500/);
      expect(savingsPill.textContent).toContain('300');
    });

    it('should render the custom currency symbol when provided', () => {
      setTestInput(component.totals, totals);
      setTestInput(component.currency, 'EUR');
      fixture.detectChanges();

      const incomePill: HTMLElement = fixture.nativeElement.querySelector(
        '[data-testid="income-pill"]',
      );
      expect(incomePill.textContent).toContain('€');
      expect(incomePill.textContent).not.toContain('CHF');
    });

    it('should apply the ph-no-capture class on amount values for privacy', () => {
      setTestInput(component.totals, totals);
      fixture.detectChanges();

      const phNodes = fixture.nativeElement.querySelectorAll('.ph-no-capture');
      expect(phNodes.length).toBeGreaterThanOrEqual(3);
    });
  });
});
