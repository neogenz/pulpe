import { describe, expect, it } from 'vitest';
import {
  canConfirmTransactionImport,
  transactionImportPreviewSchema,
  transactionImportRequestSchema,
  type TransactionImportOperation,
} from '../schemas.js';

const operation = (
  overrides: Partial<TransactionImportOperation> = {},
): TransactionImportOperation => ({
  position: 1,
  date: '2026-03-10',
  name: 'Boulangerie',
  amount: 12.5,
  kind: 'expense',
  status: 'new',
  ...overrides,
});

describe('canConfirmTransactionImport', () => {
  it('needs at least one new operation and no error', () => {
    expect(
      canConfirmTransactionImport({ operations: [operation()], errors: [] }),
    ).toBe(true);
    expect(
      canConfirmTransactionImport({
        operations: [operation({ status: 'already_imported' })],
        errors: [],
      }),
    ).toBe(false);
    expect(
      canConfirmTransactionImport({
        operations: [operation()],
        errors: [{ code: 'missing_date', position: 2 }],
      }),
    ).toBe(false);
  });
});

describe('transactionImportPreviewSchema', () => {
  it('accepts an unrecognised file with its single error', () => {
    expect(
      transactionImportPreviewSchema.parse({
        format: null,
        period: { startDate: '2026-03-01', endDate: '2026-03-31' },
        currency: 'CHF',
        operations: [],
        errors: [{ code: 'unsupported_format', position: null }],
      }).format,
    ).toBeNull();
  });

  it('never carries a saving: imports are money in or out', () => {
    expect(() =>
      transactionImportPreviewSchema.parse({
        format: 'camt053',
        period: { startDate: '2026-03-01', endDate: '2026-03-31' },
        currency: 'CHF',
        operations: [{ ...operation(), kind: 'saving' }],
        errors: [],
      }),
    ).toThrow();
  });
});

describe('transactionImportRequestSchema', () => {
  it('only takes the target budget', () => {
    expect(() =>
      transactionImportRequestSchema.parse({
        budgetId: '11111111-1111-4111-8111-111111111111',
        format: 'camt053',
      }),
    ).toThrow();
  });
});
