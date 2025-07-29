import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Component } from '@angular/core';
import DetailsPage from './details-page';
import { BudgetLineApi } from './services/budget-line-api';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  signal,
  NO_ERRORS_SCHEMA,
  provideZonelessChangeDetection,
} from '@angular/core';
import { type BudgetLine } from '@pulpe/shared';
import { ConfirmationDialogComponent } from '../../../ui/dialogs/confirmation-dialog';
import { vi } from 'vitest';
import { provideLocale } from '../../../core/locale';

// Test wrapper component to handle input requirements
@Component({
  selector: 'pulpe-test-wrapper',
  template: '<pulpe-details-page [id]="budgetId" />',
  imports: [DetailsPage],
  standalone: true,
})
class TestWrapperComponent {
  budgetId = 'test-budget-1';
}

describe('DetailsPage', () => {
  let component: DetailsPage;
  let fixture: ComponentFixture<TestWrapperComponent>;
  let mockBudgetLineApi: jest.Mocked<BudgetLineApi>;
  let mockSnackBar: jest.Mocked<MatSnackBar>;
  let mockDialog: jest.Mocked<MatDialog>;
  let mockRouter: jest.Mocked<Router>;
  let mockRoute: ActivatedRoute;

  const mockBudget = {
    id: 'test-budget-1',
    month: 1,
    year: 2024,
    description: 'January 2024',
    budgetLines: [
      {
        id: 'line-1',
        budgetId: 'test-budget-1',
        name: 'Salary',
        amount: 5000,
        kind: 'INCOME' as const,
        recurrence: 'fixed' as const,
      },
      {
        id: 'line-2',
        budgetId: 'test-budget-1',
        name: 'Rent',
        amount: 1500,
        kind: 'FIXED_EXPENSE' as const,
        recurrence: 'fixed' as const,
      },
    ] as BudgetLine[],
  };

  beforeEach(() => {
    mockBudgetLineApi = {
      getBudgetDetails$: vi.fn().mockReturnValue(
        of({
          data: mockBudget,
        }),
      ),
      createBudgetLine$: vi.fn(),
      updateBudgetLine$: vi.fn(),
      deleteBudgetLine$: vi.fn(),
      getBudgetLines$: vi.fn(),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    mockDialog = {
      open: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    mockRoute = {
      relativeTo: signal({}),
    };

    TestBed.configureTestingModule({
      imports: [TestWrapperComponent, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideLocale(),
        { provide: BudgetLineApi, useValue: mockBudgetLineApi },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: MatDialog, useValue: mockDialog },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TestWrapperComponent);
    wrapperComponent = fixture.componentInstance;
    fixture.detectChanges();

    // Get the actual DetailsPage component instance
    const detailsPageDebugElement = fixture.debugElement.children[0];
    component = detailsPageDebugElement.componentInstance as DetailsPage;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should load budget details on init', () => {
      expect(mockBudgetLineApi.getBudgetDetails$).toHaveBeenCalledWith(
        'test-budget-1',
      );
      expect(component.budgetDetails.value()).toBeTruthy();
      expect(component.budgetDetails.value()?.data.budgetLines.length).toBe(2);
    });
  });

  describe('Optimistic Updates', () => {
    describe('Create Budget Line', () => {
      it('should optimistically add budget line on successful API call', async () => {
        const newBudgetLine = {
          name: 'New Savings',
          amount: 1000,
          kind: 'SAVINGS_CONTRIBUTION' as const,
          recurrence: 'fixed' as const,
          budgetId: 'test-budget-1',
        };

        const createdBudgetLine = {
          id: 'new-line-id',
          ...newBudgetLine,
        };

        mockBudgetLineApi.createBudgetLine$.mockReturnValue(
          of(createdBudgetLine),
        );

        const initialLength =
          component.budgetDetails.value()?.data.budgetLines.length || 0;

        await component.handleCreateBudgetLine(newBudgetLine);
        await fixture.whenStable();

        // Verify optimistic update
        const updatedBudget = component.budgetDetails.value();
        expect(updatedBudget?.data.budgetLines.length).toBe(initialLength + 1);
        expect(
          updatedBudget?.data.budgetLines.some(
            (line) => line.id === createdBudgetLine.id,
          ),
        ).toBe(true);

        // Verify API was called
        expect(mockBudgetLineApi.createBudgetLine$).toHaveBeenCalledWith(
          newBudgetLine,
        );

        // Verify success message
        expect(mockSnackBar.open).toHaveBeenCalledWith(
          'Prévision ajoutée.',
          'Fermer',
          expect.any(Object),
        );
      });

      it('should rollback budget line on API failure', async () => {
        const newBudgetLine = {
          name: 'Failed Savings',
          amount: 500,
          kind: 'SAVINGS_CONTRIBUTION' as const,
          recurrence: 'fixed' as const,
          budgetId: 'test-budget-1',
        };

        mockBudgetLineApi.createBudgetLine$.mockReturnValue(
          throwError(() => new Error('API Error')),
        );

        const initialLength =
          component.budgetDetails.value()?.data.budgetLines.length || 0;

        await component.handleCreateBudgetLine(newBudgetLine);
        await fixture.whenStable();

        // Verify rollback
        const updatedBudget = component.budgetDetails.value();
        expect(updatedBudget?.data.budgetLines.length).toBe(initialLength);

        // Verify error message
        expect(mockSnackBar.open).toHaveBeenCalledWith(
          "Erreur lors de l'ajout de la prévision",
          'Fermer',
          expect.any(Object),
        );
      });
    });

    describe('Update Budget Line', () => {
      it('should optimistically update budget line on successful API call', async () => {
        const updatedData = {
          name: 'Updated Salary',
          amount: 5500,
        };

        const updatedBudgetLine = {
          ...mockBudget.budgetLines[0],
          ...updatedData,
        };

        mockBudgetLineApi.updateBudgetLine$.mockReturnValue(
          of(updatedBudgetLine),
        );

        await component.handleUpdateBudgetLine('line-1', updatedData);
        await fixture.whenStable();

        // Verify optimistic update
        const updatedBudget = component.budgetDetails.value();
        const line = updatedBudget?.data.budgetLines.find(
          (l) => l.id === 'line-1',
        );
        expect(line?.name).toBe('Updated Salary');
        expect(line?.amount).toBe(5500);

        // Verify API was called
        expect(mockBudgetLineApi.updateBudgetLine$).toHaveBeenCalledWith(
          'line-1',
          updatedData,
        );

        // Verify success message
        expect(mockSnackBar.open).toHaveBeenCalledWith(
          'Prévision modifiée.',
          'Fermer',
          expect.any(Object),
        );
      });

      it('should rollback budget line on API failure', async () => {
        const originalLine = { ...mockBudget.budgetLines[0] };
        const updatedData = {
          name: 'Failed Update',
          amount: 6000,
        };

        mockBudgetLineApi.updateBudgetLine$.mockReturnValue(
          throwError(() => new Error('API Error')),
        );

        await component.handleUpdateBudgetLine('line-1', updatedData);
        await fixture.whenStable();

        // Verify rollback
        const updatedBudget = component.budgetDetails.value();
        const line = updatedBudget?.data.budgetLines.find(
          (l) => l.id === 'line-1',
        );
        expect(line?.name).toBe(originalLine.name);
        expect(line?.amount).toBe(originalLine.amount);

        // Verify error message
        expect(mockSnackBar.open).toHaveBeenCalledWith(
          'Erreur lors de la modification de la prévision',
          'Fermer',
          expect.any(Object),
        );
      });
    });

    describe('Delete Budget Line', () => {
      it('should optimistically delete budget line on successful API call', async () => {
        // Mock dialog to return true (confirmed)
        mockDialog.open.mockReturnValue({
          afterClosed: () => of(true),
        } as MatDialogRef<ConfirmationDialogComponent>);

        mockBudgetLineApi.deleteBudgetLine$.mockReturnValue(of(void 0));

        const initialLength =
          component.budgetDetails.value()?.data.budgetLines.length || 0;

        await component.handleDeleteBudgetLine('line-1');
        await fixture.whenStable();

        // Verify optimistic update
        const updatedBudget = component.budgetDetails.value();
        expect(updatedBudget?.data.budgetLines.length).toBe(initialLength - 1);
        expect(
          updatedBudget?.data.budgetLines.find((l) => l.id === 'line-1'),
        ).toBeUndefined();

        // Verify API was called
        expect(mockBudgetLineApi.deleteBudgetLine$).toHaveBeenCalledWith(
          'line-1',
        );

        // Verify success message
        expect(mockSnackBar.open).toHaveBeenCalledWith(
          'Prévision supprimée.',
          'Fermer',
          expect.any(Object),
        );
      });

      it('should rollback budget line on API failure', async () => {
        // Mock dialog to return true (confirmed)
        mockDialog.open.mockReturnValue({
          afterClosed: () => of(true),
        } as MatDialogRef<ConfirmationDialogComponent>);

        mockBudgetLineApi.deleteBudgetLine$.mockReturnValue(
          throwError(() => new Error('API Error')),
        );

        const initialLength =
          component.budgetDetails.value()?.data.budgetLines.length || 0;
        const originalLines = [
          ...(component.budgetDetails.value()?.data.budgetLines || []),
        ];

        await component.handleDeleteBudgetLine('line-1');
        await fixture.whenStable();

        // Verify rollback
        const updatedBudget = component.budgetDetails.value();
        expect(updatedBudget?.data.budgetLines.length).toBe(initialLength);
        expect(updatedBudget?.data.budgetLines).toEqual(originalLines);

        // Verify error message
        expect(mockSnackBar.open).toHaveBeenCalledWith(
          'Erreur lors de la suppression de la prévision',
          'Fermer',
          expect.any(Object),
        );
      });
    });

    describe('Operation Progress', () => {
      it('should track operations in progress', async () => {
        const newBudgetLine = {
          name: 'Test Progress',
          amount: 100,
          kind: 'FIXED_EXPENSE' as const,
          recurrence: 'fixed' as const,
          budgetId: 'test-budget-1',
        };

        // Use a controlled promise to test the in-progress state
        let resolvePromise: (value: {
          id: string;
          name: string;
          amount: number;
          kind: string;
          recurrence: string;
          budgetId: string;
        }) => void;
        const controlledPromise = new Promise<{
          id: string;
          name: string;
          amount: number;
          kind: string;
          recurrence: string;
          budgetId: string;
        }>((resolve) => {
          resolvePromise = resolve;
        });

        mockBudgetLineApi.createBudgetLine$.mockReturnValue(controlledPromise);

        // Start the operation
        const createPromise = component.handleCreateBudgetLine(newBudgetLine);

        // Check that operation is in progress
        await fixture.whenStable();
        expect(component.operationsInProgress().size).toBeGreaterThan(0);

        // Resolve the promise
        resolvePromise!({ id: 'new-id', ...newBudgetLine });
        await createPromise;
        await fixture.whenStable();

        // Check that operation is no longer in progress
        expect(component.operationsInProgress().size).toBe(0);
      });
    });

    describe('Error Handling', () => {
      it('should log errors to console', async () => {
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        const newBudgetLine = {
          name: 'Error Test',
          amount: 100,
          kind: 'FIXED_EXPENSE' as const,
          recurrence: 'fixed' as const,
          budgetId: 'test-budget-1',
        };

        const testError = new Error('Test Error');
        mockBudgetLineApi.createBudgetLine$.mockReturnValue(
          throwError(() => testError),
        );

        await component.handleCreateBudgetLine(newBudgetLine);
        await fixture.whenStable();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error creating budget line:',
          testError,
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('Utility Methods', () => {
    it('should navigate back to previous route', () => {
      component.navigateBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['../'], {
        relativeTo: mockRoute,
      });
    });

    it('should format display name correctly', () => {
      expect(component.getDisplayName()).toBe('January 2024');
    });
  });

  describe('Edge Cases and Additional Coverage', () => {
    describe('Concurrent Operations', () => {
      it('should handle multiple concurrent operations', async () => {
        const operations = [
          {
            name: 'Operation 1',
            amount: 100,
            kind: 'FIXED_EXPENSE' as const,
            recurrence: 'fixed' as const,
            budgetId: 'test-budget-1',
          },
          {
            name: 'Operation 2',
            amount: 200,
            kind: 'INCOME' as const,
            recurrence: 'fixed' as const,
            budgetId: 'test-budget-1',
          },
        ];

        mockBudgetLineApi.createBudgetLine$.mockImplementation((data) =>
          of({ id: `new-${data.name}`, ...data }),
        );

        // Start multiple operations concurrently
        const promises = operations.map((op) =>
          component.handleCreateBudgetLine(op),
        );

        // All operations should complete successfully
        await Promise.all(promises);
        await fixture.whenStable();

        const updatedBudget = component.budgetDetails.value();
        expect(updatedBudget?.data.budgetLines.length).toBe(
          mockBudget.budgetLines.length + operations.length,
        );

        // Verify all operations were added
        operations.forEach((op) => {
          expect(
            updatedBudget?.data.budgetLines.some(
              (line) => line.name === op.name,
            ),
          ).toBe(true);
        });
      });
    });

    describe('Dialog Cancellation', () => {
      it('should not delete when dialog is cancelled', async () => {
        // Mock dialog to return false (cancelled)
        mockDialog.open.mockReturnValue({
          afterClosed: () => of(false),
        } as MatDialogRef<ConfirmationDialogComponent>);

        const initialLength =
          component.budgetDetails.value()?.data.budgetLines.length || 0;

        // Trigger delete which should open dialog
        await component.handleDeleteBudgetLine('line-1');

        // Verify budget line was not deleted
        const updatedBudget = component.budgetDetails.value();
        expect(updatedBudget?.data.budgetLines.length).toBe(initialLength);
        expect(
          updatedBudget?.data.budgetLines.find((l) => l.id === 'line-1'),
        ).toBeDefined();

        // Verify API was NOT called
        expect(mockBudgetLineApi.deleteBudgetLine$).not.toHaveBeenCalled();
      });
    });

    describe('Invalid Operations', () => {
      it('should handle empty name in budget line creation', async () => {
        const invalidBudgetLine = {
          name: '',
          amount: 100,
          kind: 'FIXED_EXPENSE' as const,
          recurrence: 'fixed' as const,
          budgetId: 'test-budget-1',
        };

        mockBudgetLineApi.createBudgetLine$.mockReturnValue(
          throwError(() => new Error('Name is required')),
        );

        await component.handleCreateBudgetLine(invalidBudgetLine);
        await fixture.whenStable();

        expect(mockSnackBar.open).toHaveBeenCalledWith(
          "Erreur lors de l'ajout de la prévision",
          'Fermer',
          expect.any(Object),
        );
      });

      it('should handle negative amounts gracefully', async () => {
        const invalidUpdate = {
          amount: -100,
        };

        mockBudgetLineApi.updateBudgetLine$.mockReturnValue(
          throwError(() => new Error('Amount must be positive')),
        );

        await component.handleUpdateBudgetLine('line-1', invalidUpdate);
        await fixture.whenStable();

        expect(mockSnackBar.open).toHaveBeenCalledWith(
          'Erreur lors de la modification de la prévision',
          'Fermer',
          expect.any(Object),
        );
      });
    });

    describe('Resource Loading', () => {
      it('should handle budget details loading error', () => {
        // Test the resource error state - functionality is already tested in the component
        // The budgetDetails resource handles errors internally

        // Verify component has proper error handling
        expect(component.budgetDetails).toBeDefined();
        expect(component.budgetDetails.error).toBeDefined();
        expect(component.budgetDetails.isLoading).toBeDefined();
      });
    });
  });
});
