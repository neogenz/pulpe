import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Component,
  model,
  NO_ERRORS_SCHEMA,
  provideZonelessChangeDetection,
} from '@angular/core';
import { CurrencyPipe, registerLocaleData } from '@angular/common';
import localeDeCH from '@angular/common/locales/de-CH';
import { BreakpointObserver } from '@angular/cdk/layout';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Logger } from '@core/logging/logger';
import { BehaviorSubject, of } from 'rxjs';
// Import the internal API for signal manipulation in tests
// This is a workaround for the signal inputs testing issue with Vitest
import { SIGNAL, signalSetFn } from '@angular/core/primitives/signals';
import { createMockLogger } from '../../../../testing/mock-posthog';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import {
  RecurrenceLabelPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import { type BudgetLineViewModel } from '../models/budget-line-view-model';
import { type TransactionViewModel } from '../models/transaction-view-model';
import { BudgetTable } from './budget-table';
import { BudgetTableDataProvider } from './budget-table-data-provider';
import type { BudgetTableViewMode } from './budget-table-view-mode';

// Mock component for BudgetTableViewToggle
@Component({
  selector: 'pulpe-budget-table-view-toggle',
  template: '',
})
class MockBudgetTableViewToggle {
  viewMode = model<BudgetTableViewMode>('envelopes');
}

// Register locale for currency formatting
registerLocaleData(localeDeCH);

describe('BudgetTable', () => {
  let component: BudgetTable;
  let fixture: ComponentFixture<BudgetTable>;
  let breakpointSubject: BehaviorSubject<{
    matches: boolean;
    breakpoints: Record<string, boolean>;
  }>;
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockLogger: ReturnType<typeof createMockLogger>;

  const mockBudgetLines: BudgetLineViewModel[] = [
    {
      id: 'budget-line-1',
      name: 'Test Budget Line',
      amount: 1000,
      kind: 'expense',
      recurrence: 'fixed',
      isManuallyAdjusted: false,
      budgetId: 'budget-1',
      templateLineId: null,
      savingsGoalId: null,
      checkedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockTransactions: TransactionViewModel[] = [];

  beforeEach(async () => {
    breakpointSubject = new BehaviorSubject<{
      matches: boolean;
      breakpoints: Record<string, boolean>;
    }>({
      matches: false,
      breakpoints: {},
    });

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: vi.fn().mockReturnValue(of(undefined)),
      }),
    };

    mockLogger = createMockLogger();

    await TestBed.configureTestingModule({
      imports: [BudgetTable, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: BreakpointObserver,
          useValue: {
            observe: vi.fn().mockReturnValue(breakpointSubject.asObservable()),
          },
        },
        { provide: MatDialog, useValue: mockDialog },
        { provide: Logger, useValue: mockLogger },
        BudgetTableDataProvider,
      ],
    });

    // Override BudgetTable imports to replace BudgetTableViewToggle with mock
    // Using NO_ERRORS_SCHEMA to avoid errors with model() signal bindings
    TestBed.overrideComponent(BudgetTable, {
      set: {
        imports: [
          MatTableModule,
          MatCardModule,
          MatIconModule,
          MatButtonModule,
          MatFormFieldModule,
          MatInputModule,
          MatChipsModule,
          MatMenuModule,
          MatTooltipModule,
          MatProgressBarModule,
          MatDividerModule,
          ReactiveFormsModule,
          RouterLink,
          CurrencyPipe,
          TransactionLabelPipe,
          RecurrenceLabelPipe,
          RolloverFormatPipe,
          MockBudgetTableViewToggle,
        ],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    await TestBed.compileComponents();

    fixture = TestBed.createComponent(BudgetTable);
    component = fixture.componentInstance;

    // Set required inputs using signal API workaround for Vitest compatibility
    signalSetFn(component.budgetLines[SIGNAL], mockBudgetLines);
    signalSetFn(component.transactions[SIGNAL], mockTransactions);

    fixture.detectChanges();
  });

  describe('Desktop View', () => {
    beforeEach(() => {
      breakpointSubject.next({ matches: false, breakpoints: {} });
      fixture.detectChanges();
    });

    it('should show menu button for actions', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const menuButton = compiled.querySelector(
        '[data-testid="actions-menu-budget-line-1"]',
      );

      expect(menuButton).toBeTruthy();
    });

    it('should have menu items for edit and delete when menu opened', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const menuTrigger = compiled.querySelector(
        '[data-testid="actions-menu-budget-line-1"]',
      ) as HTMLButtonElement;

      expect(menuTrigger).toBeTruthy();
      menuTrigger?.click();
      fixture.detectChanges();

      const editButton = document.querySelector(
        '[data-testid="edit-budget-line-1"]',
      );
      const deleteButton = document.querySelector(
        '[data-testid="delete-budget-line-1"]',
      );

      expect(editButton).toBeTruthy();
      expect(deleteButton).toBeTruthy();
    });

    it('should emit delete when delete menu item clicked', () => {
      const deleteSpy = vi.spyOn(component.delete, 'emit');
      const compiled = fixture.nativeElement as HTMLElement;

      const menuTrigger = compiled.querySelector(
        '[data-testid="actions-menu-budget-line-1"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();
      fixture.detectChanges();

      const deleteButton = document.querySelector(
        '[data-testid="delete-budget-line-1"]',
      ) as HTMLButtonElement;
      deleteButton?.click();
      fixture.detectChanges();

      expect(deleteSpy).toHaveBeenCalledWith('budget-line-1');
    });

    it('should open inline edit when edit menu item clicked', () => {
      const compiled = fixture.nativeElement as HTMLElement;

      const menuTrigger = compiled.querySelector(
        '[data-testid="actions-menu-budget-line-1"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();
      fixture.detectChanges();

      const editButton = document.querySelector(
        '[data-testid="edit-budget-line-1"]',
      ) as HTMLButtonElement;
      editButton?.click();
      fixture.detectChanges();

      expect(component['inlineFormEditingItem']()).toBeTruthy();
      expect(component['inlineFormEditingItem']()?.data.id).toBe(
        'budget-line-1',
      );
    });
  });

  describe('Test ID Uniqueness', () => {
    it('should have unique test IDs for each budget line', () => {
      const multipleBudgetLines: BudgetLineViewModel[] = [
        { ...mockBudgetLines[0], id: 'line-1' },
        { ...mockBudgetLines[0], id: 'line-2' },
        { ...mockBudgetLines[0], id: 'line-3' },
      ];

      signalSetFn(component.budgetLines[SIGNAL], multipleBudgetLines);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const editButtons = compiled.querySelectorAll(
        '[data-testid^="edit-line-"]',
      );
      const deleteButtons = compiled.querySelectorAll(
        '[data-testid^="delete-line-"]',
      );

      // Check uniqueness by comparing lengths
      const editIds = new Set<string>();
      const deleteIds = new Set<string>();

      editButtons.forEach((btn) => {
        const id = btn.getAttribute('data-testid');
        if (id) editIds.add(id);
      });

      deleteButtons.forEach((btn) => {
        const id = btn.getAttribute('data-testid');
        if (id) deleteIds.add(id);
      });

      expect(editIds.size).toBe(editButtons.length);
      expect(deleteIds.size).toBe(deleteButtons.length);
    });
  });

  describe('Inline Editing', () => {
    it('should show save and cancel buttons when editing', () => {
      component.startEdit({
        data: mockBudgetLines[0],
        metadata: {
          itemType: 'budget_line',
          isEditing: false,
          isRollover: false,
          isPropagationLocked: false,
          cumulativeBalance: 0,
          kindIcon: 'arrow_downward',
          allocationLabel: 'Saisir une dépense',
        },
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const saveButton = compiled.querySelector(
        '[data-testid="save-budget-line-1"]',
      );
      const cancelButton = compiled.querySelector(
        '[data-testid="cancel-budget-line-1"]',
      );

      expect(saveButton).toBeTruthy();
      expect(cancelButton).toBeTruthy();
    });

    it('should hide action buttons when editing', () => {
      component.startEdit({
        data: mockBudgetLines[0],
        metadata: {
          itemType: 'budget_line',
          isEditing: false,
          isRollover: false,
          isPropagationLocked: false,
          cumulativeBalance: 0,
          kindIcon: 'arrow_downward',
          allocationLabel: 'Saisir une dépense',
        },
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const editButton = compiled.querySelector(
        '[data-testid="edit-budget-line-1"]',
      );
      const deleteButton = compiled.querySelector(
        '[data-testid="delete-budget-line-1"]',
      );

      expect(editButton).toBeFalsy();
      expect(deleteButton).toBeFalsy();
    });

    it('should emit update when save is clicked', () => {
      const updateSpy = vi.spyOn(component.update, 'emit');

      component.startEdit({
        data: mockBudgetLines[0],
        metadata: {
          itemType: 'budget_line',
          isEditing: false,
          isRollover: false,
          isPropagationLocked: false,
          cumulativeBalance: 0,
          kindIcon: 'arrow_downward',
          allocationLabel: 'Saisir une dépense',
        },
      });

      component.editForm.patchValue({ name: 'Updated Name', amount: 2000 });
      component.saveEdit();

      expect(updateSpy).toHaveBeenCalledWith({
        id: 'budget-line-1',
        name: 'Updated Name',
        amount: 2000,
        isManuallyAdjusted: true,
      });
    });

    it('should reset form when cancel is clicked', () => {
      component.startEdit({
        data: mockBudgetLines[0],
        metadata: {
          itemType: 'budget_line',
          isEditing: false,
          isRollover: false,
          isPropagationLocked: false,
          cumulativeBalance: 0,
          kindIcon: 'arrow_downward',
          allocationLabel: 'Saisir une dépense',
        },
      });

      component.editForm.patchValue({ name: 'Updated Name', amount: 2000 });
      component.cancelEdit();

      // Access protected property for testing purposes
      expect(component['inlineFormEditingItem']()).toBeNull();
      expect(component.editForm.value.name).toBe(null);
    });
  });

  describe('Reset From Template', () => {
    const lockedBudgetLines: BudgetLineViewModel[] = [
      {
        id: 'locked-line-1',
        name: 'Locked Budget Line',
        amount: 1500,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: true,
        budgetId: 'budget-1',
        templateLineId: 'template-1',
        savingsGoalId: null,
        checkedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const unlockedBudgetLines: BudgetLineViewModel[] = [
      {
        id: 'unlocked-line-1',
        name: 'Unlocked Budget Line',
        amount: 1000,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        budgetId: 'budget-1',
        templateLineId: 'template-1',
        savingsGoalId: null,
        checkedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    it('should show reset button only when canResetFromTemplate is true', () => {
      signalSetFn(component.budgetLines[SIGNAL], lockedBudgetLines);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      // Open the actions menu first
      const menuTrigger = compiled.querySelector(
        '[data-testid="actions-menu-locked-line-1"]',
      ) as HTMLButtonElement;
      expect(menuTrigger).toBeTruthy();
      menuTrigger?.click();
      fixture.detectChanges();

      // Query in document (overlay)
      const resetButton = document.querySelector(
        '[data-testid="reset-from-template-locked-line-1"]',
      );

      expect(resetButton).toBeTruthy();
    });

    it('should not show reset button when line is not locked', () => {
      signalSetFn(component.budgetLines[SIGNAL], unlockedBudgetLines);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      // Open the actions menu first
      const menuTrigger = compiled.querySelector(
        '[data-testid="actions-menu-unlocked-line-1"]',
      ) as HTMLButtonElement;
      expect(menuTrigger).toBeTruthy();
      menuTrigger?.click();
      fixture.detectChanges();

      // Query in document (overlay)
      const resetButton = document.querySelector(
        '[data-testid="reset-from-template-unlocked-line-1"]',
      );

      expect(resetButton).toBeFalsy();
    });

    it('should open confirmation dialog when reset button is clicked', () => {
      signalSetFn(component.budgetLines[SIGNAL], lockedBudgetLines);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      // Open the actions menu first
      const menuTrigger = compiled.querySelector(
        '[data-testid="actions-menu-locked-line-1"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();
      fixture.detectChanges();

      // Query in document (overlay)
      const resetButton = document.querySelector(
        '[data-testid="reset-from-template-locked-line-1"]',
      ) as HTMLButtonElement;

      resetButton?.click();
      fixture.detectChanges();

      expect(mockDialog.open).toHaveBeenCalledWith(
        ConfirmationDialog,
        expect.objectContaining({
          width: '400px',
          data: expect.objectContaining({
            title: 'Réinitialiser depuis le modèle',
            confirmText: 'Réinitialiser',
          }),
        }),
      );
    });

    it('should emit resetFromTemplate when dialog is confirmed', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: vi.fn().mockReturnValue(of(true)),
      });

      const resetSpy = vi.spyOn(component.resetFromTemplate, 'emit');

      signalSetFn(component.budgetLines[SIGNAL], lockedBudgetLines);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      // Open the actions menu first
      const menuTrigger = compiled.querySelector(
        '[data-testid="actions-menu-locked-line-1"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();
      fixture.detectChanges();

      // Query in document (overlay)
      const resetButton = document.querySelector(
        '[data-testid="reset-from-template-locked-line-1"]',
      ) as HTMLButtonElement;

      resetButton?.click();
      fixture.detectChanges();

      expect(resetSpy).toHaveBeenCalledWith('locked-line-1');
    });

    it('should not emit resetFromTemplate when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: vi.fn().mockReturnValue(of(false)),
      });

      const resetSpy = vi.spyOn(component.resetFromTemplate, 'emit');

      signalSetFn(component.budgetLines[SIGNAL], lockedBudgetLines);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      // Open the actions menu first
      const menuTrigger = compiled.querySelector(
        '[data-testid="actions-menu-locked-line-1"]',
      ) as HTMLButtonElement;
      menuTrigger?.click();
      fixture.detectChanges();

      // Query in document (overlay)
      const resetButton = document.querySelector(
        '[data-testid="reset-from-template-locked-line-1"]',
      ) as HTMLButtonElement;

      resetButton?.click();
      fixture.detectChanges();

      expect(resetSpy).not.toHaveBeenCalled();
    });
  });
});
