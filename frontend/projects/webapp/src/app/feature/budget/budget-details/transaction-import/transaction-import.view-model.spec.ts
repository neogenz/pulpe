import { describe, expect, it } from 'vitest';
import {
  TRANSACTION_IMPORT_MAX_FILE_BYTES,
  TRANSACTION_IMPORT_MAX_OPERATIONS,
  type TransactionImportOperation,
} from 'pulpe-shared';
import {
  buildStatusSummary,
  confirmLabelKey,
  countOperationsByStatus,
  importSuccessKey,
  isFileTooLarge,
  isPreviewStale,
  toErrorRows,
  toOperationRows,
} from './transaction-import.view-model';

function operation(
  overrides: Partial<TransactionImportOperation> = {},
): TransactionImportOperation {
  return {
    position: 1,
    date: '2026-03-04',
    name: 'Migros',
    amount: 42.5,
    kind: 'expense',
    status: 'new',
    ...overrides,
  };
}

describe('transaction import view model', () => {
  describe('isFileTooLarge', () => {
    it('should accept a file exactly at the ceiling', () => {
      expect(isFileTooLarge({ size: TRANSACTION_IMPORT_MAX_FILE_BYTES })).toBe(
        false,
      );
    });

    it('should refuse a file one byte over the ceiling', () => {
      expect(
        isFileTooLarge({ size: TRANSACTION_IMPORT_MAX_FILE_BYTES + 1 }),
      ).toBe(true);
    });
  });

  describe('countOperationsByStatus', () => {
    it('should count every status, zero included', () => {
      const counts = countOperationsByStatus([
        operation({ status: 'new' }),
        operation({ status: 'new' }),
        operation({ status: 'already_imported' }),
        operation({ status: 'pending' }),
      ]);

      expect(counts).toEqual({
        new: 2,
        already_imported: 1,
        outside_period: 0,
        pending: 1,
      });
    });
  });

  describe('buildStatusSummary', () => {
    it('should always show the count to import and hide absent skipped statuses', () => {
      const summary = buildStatusSummary({
        new: 0,
        already_imported: 0,
        outside_period: 3,
        pending: 0,
      });

      expect(summary.map((item) => item.status)).toEqual([
        'new',
        'outside_period',
      ]);
    });

    it('should pick the singular or plural key for already imported operations', () => {
      const one = buildStatusSummary({
        new: 1,
        already_imported: 1,
        outside_period: 0,
        pending: 0,
      });
      const many = buildStatusSummary({
        new: 1,
        already_imported: 2,
        outside_period: 0,
        pending: 0,
      });

      expect(one[1].key).toBe('transactionImport.summaryAlreadyImportedOne');
      expect(many[1].key).toBe('transactionImport.summaryAlreadyImportedMany');
    });
  });

  describe('toOperationRows', () => {
    it('should label only skipped operations with their status', () => {
      const rows = toOperationRows([
        operation({ position: 1, status: 'new', kind: 'income' }),
        operation({ position: 2, status: 'outside_period' }),
      ]);

      expect(rows[0]).toMatchObject({
        isNew: true,
        statusKey: null,
        kindKey: 'transactionKind.income',
      });
      expect(rows[1]).toMatchObject({
        isNew: false,
        statusKey: 'transactionImport.statusOutsidePeriod',
        kindKey: 'transactionKind.expense',
      });
    });
  });

  describe('toErrorRows', () => {
    it('should translate each code and keep its position', () => {
      const rows = toErrorRows([
        { code: 'missing_date', position: 4 },
        { code: 'too_many_operations', position: null },
      ]);

      expect(rows).toEqual([
        {
          key: 'transactionImport.errorCode.missingDate',
          params: { max: TRANSACTION_IMPORT_MAX_OPERATIONS },
          position: 4,
        },
        {
          key: 'transactionImport.errorCode.tooManyOperations',
          params: { max: TRANSACTION_IMPORT_MAX_OPERATIONS },
          position: null,
        },
      ]);
    });
  });

  describe('labels', () => {
    it.each([
      [0, 'transactionImport.confirmNone'],
      [1, 'transactionImport.confirmOne'],
      [5, 'transactionImport.confirmMany'],
    ])('should label the confirm button for %i operations', (count, key) => {
      expect(confirmLabelKey(count)).toBe(key);
    });

    it.each([
      [1, 'transactionImport.successOne'],
      [3, 'transactionImport.successMany'],
    ])('should pick the success key for %i created', (count, key) => {
      expect(importSuccessKey(count)).toBe(key);
    });
  });

  describe('isPreviewStale', () => {
    it.each([
      ['ERR_TRANSACTION_IMPORT_CONFLICT', true],
      ['ERR_TRANSACTION_IMPORT_INVALID', true],
      ['ERR_TRANSACTION_IMPORT_FAILED', false],
      [null, false],
    ])('should flag %s as stale: %s', (code, expected) => {
      expect(isPreviewStale(code)).toBe(expected);
    });
  });
});
