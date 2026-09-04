import { provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import {
  type BudgetExportResponse,
  type BudgetGenerateResponse,
} from 'pulpe-shared';

import { ExcelExportService } from '@core/budget/excel-export.service';
import { FileDownloadService } from '@core/file-download';
import { Logger } from '@core/logging/logger';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { TitleDisplay } from '@core/routing';
import { UserSettingsStore } from '@core/user-settings';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import BudgetListPage from './budget-list-page';
import { BudgetListStore } from './budget-list-store';
import { PlanBudgetsDialog } from './plan-budgets/plan-budgets-dialog';

describe('BudgetListPage', () => {
  const fileDownload = { asJson: vi.fn(), asExcel: vi.fn() };
  let fixture: ComponentFixture<BudgetListPage>;
  let component: BudgetListPage;
  const dialogOpen = vi.fn();
  const snackBarOpen = vi.fn();
  let mockStore: {
    budgets: { status: ReturnType<typeof signal<string>> };
    currentDate: ReturnType<typeof signal<{ month: number; year: number }>>;
    refreshData: ReturnType<typeof vi.fn>;
    exportAllBudgets: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.stubEnv('TZ', 'Europe/Zurich');

    mockStore = {
      budgets: { status: signal('resolved') },
      currentDate: signal({ month: 9, year: 2026 }),
      refreshData: vi.fn(),
      exportAllBudgets: vi.fn().mockResolvedValue({
        success: true,
        data: { exportDate: '2026-01-01', totalBudgets: 0, budgets: [] },
      } satisfies BudgetExportResponse),
    };
    dialogOpen.mockReset();
    snackBarOpen.mockReset();

    await TestBed.configureTestingModule({
      imports: [BudgetListPage],
      providers: [
        { provide: FileDownloadService, useValue: fileDownload },
        provideZonelessChangeDetection(),
        provideRouter([]),
        ...provideTranslocoForTest(),
        { provide: BudgetListStore, useValue: mockStore },
        { provide: TitleDisplay, useValue: { currentTitle: signal('') } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: false }) },
        },
        { provide: MatSnackBar, useValue: { open: snackBarOpen } },
        { provide: Logger, useValue: { error: vi.fn() } },
        { provide: LoadingIndicator, useValue: { setLoading: vi.fn() } },
        {
          provide: ExcelExportService,
          useValue: { buildSheets: vi.fn().mockResolvedValue([]) },
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
    fileDownload.asJson.mockClear();
    fileDownload.asExcel.mockClear();
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
      expect(fileDownload.asExcel).toHaveBeenCalledWith(
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
      expect(fileDownload.asJson).toHaveBeenCalledWith(
        expect.anything(),
        'pulpe-export-2026-01-01',
      );
    });
  });

  describe('openPlanBudgetsDialog', () => {
    it.each([
      [2, 1, '2 budgets créés · 1 déjà existant ignoré'],
      [1, 2, '1 budget créé · 2 déjà existants ignorés'],
    ])(
      'passes the current cycle and announces %i created and %i skipped',
      async (created, skipped, message) => {
        const result = {
          success: true,
          data: {
            budgets: Array.from({ length: created }, () => ({})),
            skippedMonths: Array.from({ length: skipped }, (_, index) => ({
              month: 10 + index,
              year: 2026,
            })),
          },
        } as BudgetGenerateResponse;
        dialogOpen.mockReturnValue({ afterClosed: () => of(result) });

        await component.openPlanBudgetsDialog();

        expect(dialogOpen).toHaveBeenCalledWith(
          PlanBudgetsDialog,
          expect.objectContaining({
            data: { currentPeriod: { month: 9, year: 2026 } },
          }),
        );
        expect(snackBarOpen).toHaveBeenCalledWith(
          message,
          expect.any(String),
          expect.any(Object),
        );
      },
    );
  });
});
