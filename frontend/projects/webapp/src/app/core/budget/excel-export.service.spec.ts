import { TestBed } from '@angular/core/testing';
import { LOCALE_ID, signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import type {
  BudgetExportResponse,
  BudgetWithDetails,
  SupportedCurrency,
} from 'pulpe-shared';
import { UserSettingsStore } from '@core/user-settings';
import { TagStore } from '@core/tag';
import { createMockTagStore } from '@app/testing/tag-store.mock';
import {
  createMockBudget,
  createMockBudgetLine,
  createMockTransaction,
} from '@app/testing/mock-factories';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { ExcelExportService } from './excel-export.service';

const CHF_FORMAT = '"CHF" #,##0.00';

function createExportResponse(
  budget: Partial<BudgetWithDetails>,
): BudgetExportResponse {
  return {
    success: true,
    data: {
      exportDate: '2026-01-01',
      totalBudgets: 1,
      budgets: [
        {
          ...createMockBudget({ month: 3, year: 2026 }),
          rollover: 0,
          remaining: 0,
          budgetLines: [],
          transactions: [],
          ...budget,
        } as BudgetWithDetails,
      ],
    },
  };
}

describe('ExcelExportService', () => {
  let service: ExcelExportService;
  let currency: WritableSignal<SupportedCurrency>;

  beforeEach(() => {
    currency = signal<SupportedCurrency>('CHF');

    TestBed.configureTestingModule({
      providers: [
        ...provideTranslocoForTest(),
        // Pinned: the sheet header carries a month name straight out of CLDR,
        // and jsdom would otherwise resolve `LOCALE_ID` from its own `en-US`.
        { provide: LOCALE_ID, useValue: 'fr-CH' },
        ExcelExportService,
        { provide: UserSettingsStore, useValue: { currency } },
        { provide: TagStore, useValue: createMockTagStore() },
      ],
    });

    service = TestBed.inject(ExcelExportService);
  });

  describe('buildSheets', () => {
    it('should name one sheet per budget and size its columns', async () => {
      const response = createExportResponse({ month: 3, year: 2026 });

      const sheets = await service.buildSheets(response);

      expect(sheets).toHaveLength(1);
      expect(sheets[0].sheet).toBe('03-2026');
      expect(sheets[0].columns).toEqual([
        { width: 25 },
        { width: 15 },
        { width: 12 },
        { width: 12 },
        { width: 15 },
      ]);
    });

    it('should return no sheet when the export carries no budget', async () => {
      const sheets = await service.buildSheets({
        success: true,
        data: { exportDate: '2026-01-01', totalBudgets: 0, budgets: [] },
      });

      expect(sheets).toEqual([]);
    });

    it('should write amounts as numbers carrying the currency format', async () => {
      const response = createExportResponse({
        budgetLines: [createMockBudgetLine({ name: 'Loyer', amount: 1200 })],
      });

      const sheets = await service.buildSheets(response);

      expect(sheets[0].data[8][1]).toEqual({
        type: Number,
        value: 1200,
        format: CHF_FORMAT,
      });
    });

    it('should total budget lines with a formula spanning only their rows', async () => {
      const response = createExportResponse({
        budgetLines: [
          createMockBudgetLine({ id: 'line-1', amount: 100 }),
          createMockBudgetLine({ id: 'line-2', amount: 200 }),
        ],
      });

      const sheets = await service.buildSheets(response);
      const totalRow = sheets[0].data[10];

      expect(totalRow[0]).toBe('Total prévisions');
      expect(totalRow[1]).toEqual({
        type: 'Formula',
        value: 'SUM(B9:B10)',
        format: CHF_FORMAT,
      });
    });

    it('should total transactions with a formula spanning only their rows', async () => {
      const response = createExportResponse({
        transactions: [
          createMockTransaction({ id: 'tx-1', amount: 50 }),
          createMockTransaction({ id: 'tx-2', amount: 75 }),
        ],
      });

      const sheets = await service.buildSheets(response);
      const totalRow = sheets[0].data[13];

      expect(totalRow[1]).toBe('Total mouvements');
      expect(totalRow[2]).toEqual({
        type: 'Formula',
        value: 'SUM(C12:C13)',
        format: CHF_FORMAT,
      });
    });

    it('should omit both totals when the budget holds no line and no transaction', async () => {
      const sheets = await service.buildSheets(createExportResponse({}));

      const cells = sheets[0].data.flat();
      expect(cells).not.toContain('Total prévisions');
      expect(cells).not.toContain('Total mouvements');
    });

    it('should neutralise a name Excel would otherwise evaluate as a formula', async () => {
      const response = createExportResponse({
        budgetLines: [
          createMockBudgetLine({ name: '=1+1' }),
          createMockBudgetLine({ id: 'line-2', name: '@SUM(A1)' }),
        ],
      });

      const sheets = await service.buildSheets(response);

      expect(sheets[0].data[8][0]).toBe("'=1+1");
      expect(sheets[0].data[9][0]).toBe("'@SUM(A1)");
    });

    it('should format amounts in euros when the account is set to EUR', async () => {
      currency.set('EUR');

      const sheets = await service.buildSheets(
        createExportResponse({ rollover: 42 }),
      );

      expect(sheets[0].data[2][1]).toEqual({
        type: Number,
        value: 42,
        format: '"€" #,##0.00',
      });
    });
  });
});
