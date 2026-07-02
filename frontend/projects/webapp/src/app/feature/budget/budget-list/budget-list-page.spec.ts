import { provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { type BudgetExportResponse } from 'pulpe-shared';

import { ExcelExportService } from '@core/budget/excel-export.service';
import { downloadAsExcelFile, downloadAsJsonFile } from '@core/file-download';
import { Logger } from '@core/logging/logger';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { ProductTourService } from '@core/product-tour/product-tour.service';
import { TitleDisplay } from '@core/routing';
import { UserSettingsStore } from '@core/user-settings';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import BudgetListPage from './budget-list-page';
import { BudgetListStore } from './budget-list-store';

vi.mock('@core/file-download', () => ({
  downloadAsExcelFile: vi.fn(),
  downloadAsJsonFile: vi.fn(),
}));

describe('BudgetListPage', () => {
  let fixture: ComponentFixture<BudgetListPage>;
  let component: BudgetListPage;
  let mockStore: {
    budgets: { status: ReturnType<typeof signal<string>> };
    refreshData: ReturnType<typeof vi.fn>;
    exportAllBudgets: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.stubEnv('TZ', 'Europe/Zurich');

    mockStore = {
      budgets: { status: signal('resolved') },
      refreshData: vi.fn(),
      exportAllBudgets: vi.fn().mockResolvedValue({
        success: true,
        data: { exportDate: '2026-01-01', totalBudgets: 0, budgets: [] },
      } satisfies BudgetExportResponse),
    };

    await TestBed.configureTestingModule({
      imports: [BudgetListPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        ...provideTranslocoForTest(),
        { provide: BudgetListStore, useValue: mockStore },
        { provide: TitleDisplay, useValue: { currentTitle: signal('') } },
        {
          provide: ProductTourService,
          useValue: {
            hasSeenPageTour: vi.fn().mockReturnValue(true),
            startPageTour: vi.fn(),
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: false }) },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: Logger, useValue: { error: vi.fn() } },
        { provide: LoadingIndicator, useValue: { setLoading: vi.fn() } },
        {
          provide: ExcelExportService,
          useValue: { buildWorkbook: vi.fn().mockReturnValue({}) },
        },
        { provide: UserSettingsStore, useValue: { currency: signal('CHF') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetListPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('onExportBudgetsAsExcel', () => {
    it('should name the file with the local date, not the UTC date', async () => {
      // Arrange: Zurich local 00:30 on Jan 1st is still Dec 31st in UTC
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 0, 1, 0, 30));

      // Canary: fail loudly if the TZ override above didn't take effect,
      // instead of silently passing against a UTC-equivalent worker.
      expect(new Date().getTimezoneOffset()).toBe(-60);

      // Act
      await component.onExportBudgetsAsExcel();

      // Assert
      expect(downloadAsExcelFile).toHaveBeenCalledWith(
        expect.anything(),
        'pulpe-export-2026-01-01',
      );
    });
  });

  describe('onExportBudgets', () => {
    it('should name the file with the local date, not the UTC date', async () => {
      // Arrange: Zurich local 00:30 on Jan 1st is still Dec 31st in UTC
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 0, 1, 0, 30));

      // Canary: fail loudly if the TZ override above didn't take effect,
      // instead of silently passing against a UTC-equivalent worker.
      expect(new Date().getTimezoneOffset()).toBe(-60);

      // Act
      await component.onExportBudgets();

      // Assert
      expect(downloadAsJsonFile).toHaveBeenCalledWith(
        expect.anything(),
        'pulpe-export-2026-01-01',
      );
    });
  });
});
