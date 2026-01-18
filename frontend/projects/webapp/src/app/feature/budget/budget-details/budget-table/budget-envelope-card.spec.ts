import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDeCH from '@angular/common/locales/de-CH';
import localeFrCH from '@angular/common/locales/fr-CH';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SIGNAL, signalSetFn } from '@angular/core/primitives/signals';
import { type BudgetLine } from 'pulpe-shared';
import { BudgetEnvelopeCard } from './budget-envelope-card';
import type {
  BudgetLineConsumptionDisplay,
  BudgetLineTableItem,
} from './budget-table-models';

registerLocaleData(localeDeCH);
registerLocaleData(localeFrCH);

interface MockBudgetLineTableItemOverrides {
  data?: Partial<BudgetLine>;
  consumption?: Partial<BudgetLineConsumptionDisplay>;
  metadata?: Partial<BudgetLineTableItem['metadata']>;
}

const createMockBudgetLineTableItem = (
  overrides: MockBudgetLineTableItemOverrides = {},
): BudgetLineTableItem => {
  const baseData: BudgetLine = {
    id: 'budget-line-1',
    budgetId: 'budget-1',
    templateLineId: null,
    savingsGoalId: null,
    name: 'Courses alimentaires',
    amount: 500,
    kind: 'expense',
    recurrence: 'fixed',
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const baseConsumption: BudgetLineConsumptionDisplay = {
    consumed: 400,
    transactionCount: 2,
    percentage: 80,
    transactionCountLabel: '2 dépenses',
    hasTransactions: true,
  };

  const baseMetadata: BudgetLineTableItem['metadata'] = {
    itemType: 'budget_line',
    cumulativeBalance: 5000,
    isRollover: false,
    canResetFromTemplate: false,
    isLoading: false,
    kindIcon: 'arrow_downward',
    allocationLabel: 'Saisir une dépense',
  };

  return {
    data: { ...baseData, ...overrides.data },
    consumption: { ...baseConsumption, ...overrides.consumption },
    metadata: { ...baseMetadata, ...overrides.metadata },
  };
};

describe('BudgetEnvelopeCard', () => {
  let component: BudgetEnvelopeCard;
  let fixture: ComponentFixture<BudgetEnvelopeCard>;
  let mockItem: BudgetLineTableItem;

  beforeEach(async () => {
    mockItem = createMockBudgetLineTableItem();

    await TestBed.configureTestingModule({
      imports: [BudgetEnvelopeCard, NoopAnimationsModule],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetEnvelopeCard);
    component = fixture.componentInstance;

    signalSetFn(component.item[SIGNAL], mockItem);
    signalSetFn(component.isSelected[SIGNAL], false);

    fixture.detectChanges();
  });

  describe('Rendering', () => {
    it('should display budget line name', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Courses alimentaires');
    });

    it('should display hero amount with correct currency format', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('CHF');
      expect(compiled.textContent).toContain('500');
    });

    it('should apply strikethrough when item is checked', () => {
      const checkedItem = createMockBudgetLineTableItem({
        data: { checkedAt: new Date().toISOString() },
      });
      signalSetFn(component.item[SIGNAL], checkedItem);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const nameElement = compiled.querySelector('.line-through');
      expect(nameElement).toBeTruthy();
    });

    it('should show loading opacity when isLoading is true', () => {
      const loadingItem = createMockBudgetLineTableItem({
        metadata: { isLoading: true },
      });
      signalSetFn(component.item[SIGNAL], loadingItem);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const card = compiled.querySelector('.opacity-60');
      expect(card).toBeTruthy();
    });

    it('should apply selection ring when isSelected is true', () => {
      signalSetFn(component.isSelected[SIGNAL], true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const card = compiled.querySelector('.ring-2');
      expect(card).toBeTruthy();
    });
  });

  describe('Kind color coding', () => {
    it('should apply income color for income kind', () => {
      const incomeItem = createMockBudgetLineTableItem({
        data: { kind: 'income' },
      });
      signalSetFn(component.item[SIGNAL], incomeItem);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const indicator = compiled.querySelector(
        '[style*="--pulpe-financial-income"]',
      );
      expect(indicator).toBeTruthy();
    });

    it('should apply expense color for expense kind', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const indicator = compiled.querySelector(
        '[style*="--pulpe-financial-expense"]',
      );
      expect(indicator).toBeTruthy();
    });

    it('should apply savings color for saving kind', () => {
      const savingItem = createMockBudgetLineTableItem({
        data: { kind: 'saving' },
      });
      signalSetFn(component.item[SIGNAL], savingItem);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const indicator = compiled.querySelector(
        '[style*="--pulpe-financial-savings"]',
      );
      expect(indicator).toBeTruthy();
    });
  });

  describe('Progress bar', () => {
    it('should show progress bar when hasTransactions is true', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const progressSegments = compiled.querySelectorAll(
        '.rounded-full.flex-1',
      );
      expect(progressSegments.length).toBe(10);
    });

    it('should hide progress bar when hasTransactions is false', () => {
      const noTxItem = createMockBudgetLineTableItem({
        consumption: { hasTransactions: false },
      });
      signalSetFn(component.item[SIGNAL], noTxItem);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const progressSegments = compiled.querySelectorAll(
        '.rounded-full.flex-1',
      );
      expect(progressSegments.length).toBe(0);
    });

    it('should hide progress bar for rollover items', () => {
      const rolloverItem = createMockBudgetLineTableItem({
        metadata: { isRollover: true },
        consumption: { hasTransactions: true },
      });
      signalSetFn(component.item[SIGNAL], rolloverItem);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const progressSegments = compiled.querySelectorAll(
        '.rounded-full.flex-1',
      );
      expect(progressSegments.length).toBe(0);
    });

    it('should display percentage when consumption <= 100', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('80%');
    });

    it('should display depasse when consumption > 100', () => {
      const overspentItem = createMockBudgetLineTableItem({
        consumption: { percentage: 120, hasTransactions: true },
      });
      signalSetFn(component.item[SIGNAL], overspentItem);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('dépassé');
    });
  });

  describe('Conditional menu (rollover handling)', () => {
    it('should hide menu button for rollover items', () => {
      const rolloverItem = createMockBudgetLineTableItem({
        metadata: { isRollover: true },
      });
      signalSetFn(component.item[SIGNAL], rolloverItem);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const menuButton = compiled.querySelector('[data-testid^="card-menu-"]');
      expect(menuButton).toBeFalsy();
    });

    it('should show menu button for non-rollover items', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const menuButton = compiled.querySelector(
        '[data-testid="card-menu-budget-line-1"]',
      );
      expect(menuButton).toBeTruthy();
    });

    it('should show reset button when canResetFromTemplate is true', () => {
      const resetableItem = createMockBudgetLineTableItem({
        data: { id: 'resetable-item' },
        metadata: { canResetFromTemplate: true },
      });
      signalSetFn(component.item[SIGNAL], resetableItem);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const menuTrigger = compiled.querySelector(
        '[data-testid="card-menu-resetable-item"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();
      fixture.detectChanges();

      const resetButton = document.querySelector(
        '[data-testid="reset-from-template-resetable-item"]',
      );
      expect(resetButton).toBeTruthy();
    });

    it('should hide reset button when canResetFromTemplate is false', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const menuTrigger = compiled.querySelector(
        '[data-testid="card-menu-budget-line-1"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();
      fixture.detectChanges();

      const resetButton = document.querySelector(
        '[data-testid="reset-from-template-budget-line-1"]',
      );
      expect(resetButton).toBeFalsy();
    });
  });

  describe('Event emissions', () => {
    it('should emit cardClick when card is clicked', () => {
      const cardClickSpy = vi.spyOn(component.cardClick, 'emit');

      const compiled = fixture.nativeElement as HTMLElement;
      const card = compiled.querySelector('[role="button"]') as HTMLElement;
      card?.click();

      expect(cardClickSpy).toHaveBeenCalledWith(mockItem);
    });

    it('should emit cardClick on Enter key', () => {
      const cardClickSpy = vi.spyOn(component.cardClick, 'emit');

      const compiled = fixture.nativeElement as HTMLElement;
      const card = compiled.querySelector('[role="button"]') as HTMLElement;
      card?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(cardClickSpy).toHaveBeenCalledWith(mockItem);
    });

    it('should emit cardClick on Space key', () => {
      const cardClickSpy = vi.spyOn(component.cardClick, 'emit');

      const compiled = fixture.nativeElement as HTMLElement;
      const card = compiled.querySelector('[role="button"]') as HTMLElement;
      card?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

      expect(cardClickSpy).toHaveBeenCalledWith(mockItem);
    });

    it('should emit delete with budget line id', () => {
      const deleteSpy = vi.spyOn(component.delete, 'emit');

      const compiled = fixture.nativeElement as HTMLElement;
      const menuTrigger = compiled.querySelector(
        '[data-testid="card-menu-budget-line-1"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();
      fixture.detectChanges();

      const deleteButton = document.querySelector(
        '[data-testid="delete-budget-line-1"]',
      ) as HTMLButtonElement;
      deleteButton?.click();

      expect(deleteSpy).toHaveBeenCalledWith('budget-line-1');
    });

    it('should emit edit with BudgetLineTableItem', () => {
      const editSpy = vi.spyOn(component.edit, 'emit');

      const compiled = fixture.nativeElement as HTMLElement;
      const menuTrigger = compiled.querySelector(
        '[data-testid="card-menu-budget-line-1"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();
      fixture.detectChanges();

      const editButton = document.querySelector(
        '[data-testid="edit-budget-line-1"]',
      ) as HTMLButtonElement;
      editButton?.click();

      expect(editSpy).toHaveBeenCalledWith(mockItem);
    });

    it('should emit addTransaction with BudgetLine', () => {
      const addTransactionSpy = vi.spyOn(component.addTransaction, 'emit');

      const compiled = fixture.nativeElement as HTMLElement;
      const menuTrigger = compiled.querySelector(
        '[data-testid="card-menu-budget-line-1"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();
      fixture.detectChanges();

      const addButton = document.querySelector(
        '[data-testid="add-transaction-budget-line-1"]',
      ) as HTMLButtonElement;
      addButton?.click();

      expect(addTransactionSpy).toHaveBeenCalledWith(mockItem.data);
    });

    it('should emit resetFromTemplate with BudgetLineTableItem', () => {
      const resetSpy = vi.spyOn(component.resetFromTemplate, 'emit');

      const resetableItem = createMockBudgetLineTableItem({
        data: { id: 'resetable-item' },
        metadata: { canResetFromTemplate: true },
      });
      signalSetFn(component.item[SIGNAL], resetableItem);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const menuTrigger = compiled.querySelector(
        '[data-testid="card-menu-resetable-item"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();
      fixture.detectChanges();

      const resetButton = document.querySelector(
        '[data-testid="reset-from-template-resetable-item"]',
      ) as HTMLButtonElement;
      resetButton?.click();

      expect(resetSpy).toHaveBeenCalledWith(resetableItem);
    });

    it('should emit toggleCheck with budget line id', () => {
      const toggleCheckSpy = vi.spyOn(component.toggleCheck, 'emit');

      const compiled = fixture.nativeElement as HTMLElement;
      const toggle = compiled.querySelector(
        '[data-testid="toggle-check-budget-line-1"]',
      ) as HTMLElement;

      // Mat-slide-toggle requires dispatching a change event on the toggle button
      const toggleButton = toggle?.querySelector('button');
      toggleButton?.click();
      fixture.detectChanges();

      expect(toggleCheckSpy).toHaveBeenCalledWith('budget-line-1');
    });

    it('should prevent card click when menu button clicked', () => {
      const cardClickSpy = vi.spyOn(component.cardClick, 'emit');

      const compiled = fixture.nativeElement as HTMLElement;
      const menuTrigger = compiled.querySelector(
        '[data-testid="card-menu-budget-line-1"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();

      expect(cardClickSpy).not.toHaveBeenCalled();
    });
  });
});
