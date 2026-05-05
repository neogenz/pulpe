import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { BudgetTemplatesDialogService } from './budget-templates-dialog.service';
import { TemplateUsageDialogComponent } from './components/dialogs/template-usage-dialog';
import { TemplatePropagationDialog } from './details/components/template-propagation-dialog';

describe('BudgetTemplatesDialogService', () => {
  let service: BudgetTemplatesDialogService;
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDialog = { open: vi.fn() };
    mockSnackBar = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        BudgetTemplatesDialogService,
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    service = TestBed.inject(BudgetTemplatesDialogService);
  });

  describe('openDeleteConfirmation', () => {
    it('should open ConfirmationDialog with warn color and return true when confirmed', async () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });

      const result = await service.openDeleteConfirmation('My Template');

      expect(mockDialog.open).toHaveBeenCalledOnce();
      const [dialogComponent, config] = mockDialog.open.mock.calls[0];
      expect(dialogComponent).toBe(ConfirmationDialog);
      expect(config.data.confirmColor).toBe('warn');
      expect(result).toBe(true);
    });

    it('should return false when the user cancels', async () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(false) });

      const result = await service.openDeleteConfirmation('My Template');

      expect(result).toBe(false);
    });
  });

  describe('openUsageDialog', () => {
    it('should open TemplateUsageDialogComponent and pass budgets via setUsageData', async () => {
      const setUsageData = vi.fn();
      mockDialog.open.mockReturnValue({
        componentInstance: { setUsageData },
        afterClosed: () => of(undefined),
      });
      const budgets = [
        { id: 'b-1', month: 4, year: 2026, description: 'April' },
      ];

      await service.openUsageDialog('template-1', 'My Template', budgets);

      const [dialogComponent] = mockDialog.open.mock.calls[0];
      expect(dialogComponent).toBe(TemplateUsageDialogComponent);
      expect(setUsageData).toHaveBeenCalledWith(budgets);
    });
  });

  describe('openPropagationDialog', () => {
    it('should open TemplatePropagationDialog and return the user choice', async () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of('propagate') });

      const result = await service.openPropagationDialog('My Template');

      const [dialogComponent] = mockDialog.open.mock.calls[0];
      expect(dialogComponent).toBe(TemplatePropagationDialog);
      expect(result).toBe('propagate');
    });

    it('should return null when the user dismisses the dialog', async () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

      const result = await service.openPropagationDialog('My Template');

      expect(result).toBeNull();
    });
  });

  describe('snackbar helpers', () => {
    it('should open a short success snackbar on notifyTemplateDeleted', () => {
      service.notifyTemplateDeleted();

      expect(mockSnackBar.open).toHaveBeenCalledOnce();
      const [, action, config] = mockSnackBar.open.mock.calls[0];
      expect(action).toBeUndefined();
      expect(config).toEqual({ duration: 3000 });
    });

    it('should open an error snackbar with close action on notifyTemplateDeleteError', () => {
      service.notifyTemplateDeleteError();

      expect(mockSnackBar.open).toHaveBeenCalledOnce();
      const [, action, config] = mockSnackBar.open.mock.calls[0];
      expect(action).toBeTruthy();
      expect(config).toEqual({ duration: 5000 });
    });

    it('should use the singular success key when exactly one budget is affected', () => {
      service.notifyMutationSuccess('template.createSuccess', {
        mode: 'propagate',
        affectedBudgetIds: ['b-1'],
        affectedBudgetsCount: 1,
      });

      expect(mockSnackBar.open).toHaveBeenCalledOnce();
    });

    it('should fall back to the base success key when propagation is null', () => {
      service.notifyMutationSuccess('template.createSuccess', null);

      expect(mockSnackBar.open).toHaveBeenCalledOnce();
    });
  });
});
