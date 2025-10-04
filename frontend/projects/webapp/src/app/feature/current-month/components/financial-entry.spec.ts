import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDeCH from '@angular/common/locales/de-CH';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CurrencyPipe } from '@angular/common';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatMenuModule } from '@angular/material/menu';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
// Import the internal API for signal manipulation in tests
// This is a workaround for the signal inputs testing issue with Vitest
import { SIGNAL, signalSetFn } from '@angular/core/primitives/signals';

import {
  FinancialEntry,
  type FinancialEntryViewModel,
} from './financial-entry';
import { RolloverFormatPipe } from '@app/ui/rollover-format';

// Register locale for currency formatting
registerLocaleData(localeDeCH);

// Mock RolloverFormatPipe
class MockRolloverFormatPipe {
  transform(value: string): string {
    return value;
  }
}

describe('FinancialEntry', () => {
  let component: FinancialEntry;
  let fixture: ComponentFixture<FinancialEntry>;
  let breakpointSubject: BehaviorSubject<{ matches: boolean }>;

  const mockFinancialEntry: FinancialEntryViewModel = {
    id: 'test-id-1',
    budgetId: 'budget-id-1',
    name: 'Test Entry',
    amount: 100,
    kind: 'expense',
    transactionDate: '2023-01-01T00:00:00.000Z',
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
    isSelected: false,
    isRollover: false,
    rollover: {
      sourceBudgetId: undefined,
    },
  };

  beforeEach(async () => {
    breakpointSubject = new BehaviorSubject<{ matches: boolean }>({
      matches: false,
    });
    const mockBreakpointObserver = {
      observe: vi.fn().mockReturnValue(breakpointSubject.asObservable()),
    };

    await TestBed.configureTestingModule({
      imports: [
        FinancialEntry,
        MatMenuModule,
        MatListModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        RouterTestingModule,
        NoopAnimationsModule,
        CurrencyPipe,
      ],
      providers: [
        provideZonelessChangeDetection(),
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
        { provide: RolloverFormatPipe, useClass: MockRolloverFormatPipe },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FinancialEntry);
    component = fixture.componentInstance;

    // Set required inputs using signal API workaround for Vitest compatibility
    signalSetFn(component.data[SIGNAL], mockFinancialEntry);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Desktop view (non-mobile)', () => {
    beforeEach(() => {
      breakpointSubject.next({ matches: false }); // Desktop
      signalSetFn(component.editable[SIGNAL], true);
      signalSetFn(component.deletable[SIGNAL], true);
      fixture.detectChanges();
    });

    it('should show separate edit and delete buttons on desktop', () => {
      const editButton = fixture.debugElement.query(
        By.css('[data-testid="edit-transaction-test-id-1"]'),
      );
      const deleteButton = fixture.debugElement.query(
        By.css('[data-testid="delete-transaction-test-id-1"]'),
      );
      const menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );

      expect(editButton).toBeTruthy();
      expect(deleteButton).toBeTruthy();
      expect(menuButton).toBeFalsy();
    });

    it('should emit editClick when edit button is clicked', () => {
      vi.spyOn(component.editClick, 'emit');

      const editButton = fixture.debugElement.query(
        By.css('[data-testid="edit-transaction-test-id-1"]'),
      );
      editButton.nativeElement.click();

      expect(component.editClick.emit).toHaveBeenCalled();
    });

    it('should emit deleteClick when delete button is clicked', () => {
      vi.spyOn(component.deleteClick, 'emit');

      const deleteButton = fixture.debugElement.query(
        By.css('[data-testid="delete-transaction-test-id-1"]'),
      );
      deleteButton.nativeElement.click();

      expect(component.deleteClick.emit).toHaveBeenCalled();
    });

    it('should not show buttons when not editable or deletable', () => {
      signalSetFn(component.editable[SIGNAL], false);
      signalSetFn(component.deletable[SIGNAL], false);
      fixture.detectChanges();

      const editButton = fixture.debugElement.query(
        By.css('[data-testid="edit-transaction-test-id-1"]'),
      );
      const deleteButton = fixture.debugElement.query(
        By.css('[data-testid="delete-transaction-test-id-1"]'),
      );
      const menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );

      expect(editButton).toBeFalsy();
      expect(deleteButton).toBeFalsy();
      expect(menuButton).toBeFalsy();
    });
  });

  describe('Mobile view (handset)', () => {
    beforeEach(() => {
      breakpointSubject.next({ matches: true }); // Mobile
      signalSetFn(component.editable[SIGNAL], true);
      signalSetFn(component.deletable[SIGNAL], true);
      fixture.detectChanges();
    });

    it('should show menu button instead of separate buttons on mobile', () => {
      const editButton = fixture.debugElement.query(
        By.css(
          '[data-testid="edit-transaction-test-id-1"]:not([mat-menu-item])',
        ),
      );
      const deleteButton = fixture.debugElement.query(
        By.css(
          '[data-testid="delete-transaction-test-id-1"]:not([mat-menu-item])',
        ),
      );
      const menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );

      expect(editButton).toBeFalsy();
      expect(deleteButton).toBeFalsy();
      expect(menuButton).toBeTruthy();
    });

    it('should have menu items for edit and delete', () => {
      // Open menu first
      const menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );
      expect(menuButton).toBeTruthy();
      menuButton.nativeElement.click();
      fixture.detectChanges();

      // Query menu items in both fixture and document (overlay)
      const editMenuItem =
        fixture.nativeElement.querySelector(
          '[data-testid="edit-transaction-test-id-1"][mat-menu-item]',
        ) ||
        document.querySelector(
          '[data-testid="edit-transaction-test-id-1"][mat-menu-item]',
        );
      const deleteMenuItem =
        fixture.nativeElement.querySelector(
          '[data-testid="delete-transaction-test-id-1"][mat-menu-item]',
        ) ||
        document.querySelector(
          '[data-testid="delete-transaction-test-id-1"][mat-menu-item]',
        );

      expect(editMenuItem).toBeTruthy();
      expect(deleteMenuItem).toBeTruthy();
    });

    it('should show correct menu item text', () => {
      // Open menu first
      const menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );
      expect(menuButton).toBeTruthy();
      menuButton.nativeElement.click();
      fixture.detectChanges();

      // Query menu items in both fixture and document (overlay)
      const editMenuItem =
        fixture.nativeElement.querySelector(
          '[data-testid="edit-transaction-test-id-1"][mat-menu-item]',
        ) ||
        document.querySelector(
          '[data-testid="edit-transaction-test-id-1"][mat-menu-item]',
        );
      const deleteMenuItem =
        fixture.nativeElement.querySelector(
          '[data-testid="delete-transaction-test-id-1"][mat-menu-item]',
        ) ||
        document.querySelector(
          '[data-testid="delete-transaction-test-id-1"][mat-menu-item]',
        );

      expect(editMenuItem?.textContent?.trim()).toContain('Éditer');
      expect(deleteMenuItem?.textContent?.trim()).toContain('Supprimer');
    });

    it('should not show menu button when not editable or deletable', () => {
      signalSetFn(component.editable[SIGNAL], false);
      signalSetFn(component.deletable[SIGNAL], false);
      fixture.detectChanges();

      const menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );
      expect(menuButton).toBeFalsy();
    });

    it('should show menu button when only editable', () => {
      signalSetFn(component.editable[SIGNAL], true);
      signalSetFn(component.deletable[SIGNAL], false);
      fixture.detectChanges();

      const menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );
      expect(menuButton).toBeTruthy();

      // Open menu to check items
      menuButton.nativeElement.click();
      fixture.detectChanges();

      // Query in both fixture and document (overlay)
      const editMenuItem =
        fixture.nativeElement.querySelector(
          '[data-testid="edit-transaction-test-id-1"][mat-menu-item]',
        ) ||
        document.querySelector(
          '[data-testid="edit-transaction-test-id-1"][mat-menu-item]',
        );
      const deleteMenuItem =
        fixture.nativeElement.querySelector(
          '[data-testid="delete-transaction-test-id-1"][mat-menu-item]',
        ) ||
        document.querySelector(
          '[data-testid="delete-transaction-test-id-1"][mat-menu-item]',
        );

      expect(editMenuItem).toBeTruthy();
      expect(deleteMenuItem).toBeFalsy();
    });

    it('should show menu button when only deletable', () => {
      signalSetFn(component.editable[SIGNAL], false);
      signalSetFn(component.deletable[SIGNAL], true);
      fixture.detectChanges();

      const menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );
      expect(menuButton).toBeTruthy();

      // Open menu to check items
      menuButton.nativeElement.click();
      fixture.detectChanges();

      // Query in both fixture and document (overlay)
      const editMenuItem =
        fixture.nativeElement.querySelector(
          '[data-testid="edit-transaction-test-id-1"][mat-menu-item]',
        ) ||
        document.querySelector(
          '[data-testid="edit-transaction-test-id-1"][mat-menu-item]',
        );
      const deleteMenuItem =
        fixture.nativeElement.querySelector(
          '[data-testid="delete-transaction-test-id-1"][mat-menu-item]',
        ) ||
        document.querySelector(
          '[data-testid="delete-transaction-test-id-1"][mat-menu-item]',
        );

      expect(editMenuItem).toBeFalsy();
      expect(deleteMenuItem).toBeTruthy();
    });

    it('should emit editClick when edit menu item is clicked', () => {
      vi.spyOn(component.editClick, 'emit');

      // Open menu first
      const menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );
      menuButton.nativeElement.click();
      fixture.detectChanges();

      // Click edit menu item
      const editMenuItem =
        fixture.nativeElement.querySelector(
          '[data-testid="edit-transaction-test-id-1"][mat-menu-item]',
        ) ||
        document.querySelector(
          '[data-testid="edit-transaction-test-id-1"][mat-menu-item]',
        );
      expect(editMenuItem).toBeTruthy();
      editMenuItem?.click();

      expect(component.editClick.emit).toHaveBeenCalled();
    });

    it('should emit deleteClick when delete menu item is clicked', () => {
      vi.spyOn(component.deleteClick, 'emit');

      // Open menu first
      const menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );
      menuButton.nativeElement.click();
      fixture.detectChanges();

      // Click delete menu item
      const deleteMenuItem =
        fixture.nativeElement.querySelector(
          '[data-testid="delete-transaction-test-id-1"][mat-menu-item]',
        ) ||
        document.querySelector(
          '[data-testid="delete-transaction-test-id-1"][mat-menu-item]',
        );
      expect(deleteMenuItem).toBeTruthy();
      deleteMenuItem?.click();

      expect(component.deleteClick.emit).toHaveBeenCalled();
    });
  });

  describe('Responsive behavior', () => {
    beforeEach(() => {
      signalSetFn(component.editable[SIGNAL], true);
      signalSetFn(component.deletable[SIGNAL], true);
    });

    it('should switch from desktop to mobile view when breakpoint changes', () => {
      // Start with desktop
      breakpointSubject.next({ matches: false });
      fixture.detectChanges();

      let editButton = fixture.debugElement.query(
        By.css(
          '[data-testid="edit-transaction-test-id-1"]:not([mat-menu-item])',
        ),
      );
      let menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );

      expect(editButton).toBeTruthy();
      expect(menuButton).toBeFalsy();

      // Switch to mobile
      breakpointSubject.next({ matches: true });
      fixture.detectChanges();

      editButton = fixture.debugElement.query(
        By.css(
          '[data-testid="edit-transaction-test-id-1"]:not([mat-menu-item])',
        ),
      );
      menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );

      expect(editButton).toBeFalsy();
      expect(menuButton).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      signalSetFn(component.editable[SIGNAL], true);
      signalSetFn(component.deletable[SIGNAL], true);
    });

    it('should have proper aria-label for menu button on mobile', () => {
      breakpointSubject.next({ matches: true });
      fixture.detectChanges();

      const menuButton = fixture.debugElement.query(
        By.css('[data-testid="actions-menu-test-id-1"]'),
      );
      expect(menuButton.nativeElement.getAttribute('aria-label')).toBe(
        'Actions pour Test Entry',
      );
    });

    it('should have proper aria-labels for desktop buttons', () => {
      breakpointSubject.next({ matches: false });
      fixture.detectChanges();

      const editButton = fixture.debugElement.query(
        By.css('[data-testid="edit-transaction-test-id-1"]'),
      );
      const deleteButton = fixture.debugElement.query(
        By.css('[data-testid="delete-transaction-test-id-1"]'),
      );

      expect(editButton.nativeElement.getAttribute('aria-label')).toBe(
        'Modifier Test Entry',
      );
      expect(deleteButton.nativeElement.getAttribute('aria-label')).toBe(
        'Supprimer Test Entry',
      );
    });
  });
});
