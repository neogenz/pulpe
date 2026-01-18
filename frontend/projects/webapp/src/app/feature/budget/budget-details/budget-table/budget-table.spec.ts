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
import { setTestInput } from '../../../../testing/signal-test-utils';
import { createMockLogger } from '../../../../testing/mock-posthog';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import {
  RecurrenceLabelPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { type BudgetLineViewModel } from '../models/budget-line-view-model';
import { type TransactionViewModel } from '../models/transaction-view-model';
import { BudgetEnvelopeCard } from './budget-envelope-card';
import { BudgetEnvelopeDetailPanel } from './budget-envelope-detail-panel';
import { BudgetSectionGroup } from './budget-section-group';
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
    // Start in mobile mode to avoid BudgetEnvelopeCard lifecycle issues
    // (the card grid view has rendering timing issues with required inputs in jsdom)
    breakpointSubject = new BehaviorSubject<{
      matches: boolean;
      breakpoints: Record<string, boolean>;
    }>({
      matches: true,
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
          MatSidenavModule,
          MatSlideToggleModule,
          MatExpansionModule,
          ReactiveFormsModule,
          RouterLink,
          CurrencyPipe,
          TransactionLabelPipe,
          RecurrenceLabelPipe,
          RolloverFormatPipe,
          MockBudgetTableViewToggle,
          BudgetEnvelopeCard,
          BudgetSectionGroup,
          BudgetEnvelopeDetailPanel,
        ],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    await TestBed.compileComponents();

    fixture = TestBed.createComponent(BudgetTable);
    component = fixture.componentInstance;

    // Set required inputs using signal API workaround for Vitest compatibility
    setTestInput(component.budgetLines, mockBudgetLines);
    setTestInput(component.transactions, mockTransactions);

    fixture.detectChanges();
  });

  describe('Inline Editing (Component API)', () => {
    // Note: Tests verify component API works correctly.
    // These tests need desktop mode for inline editing (mobile uses dialog).

    beforeEach(() => {
      // Switch to desktop mode for inline editing tests
      // (inline editing only works in desktop mode; mobile opens a dialog)
      breakpointSubject.next({ matches: false, breakpoints: {} });
    });

    it('should set editing item when startEdit is called', () => {
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

      expect(component['inlineFormEditingItem']()).toBeTruthy();
      expect(component['inlineFormEditingItem']()?.data.id).toBe(
        'budget-line-1',
      );
    });

    it('should clear editing item when cancelEdit is called', () => {
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

      component.cancelEdit();

      expect(component['inlineFormEditingItem']()).toBeFalsy();
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
});
