import { describe, expect, it } from 'vitest';
import {
  canConfirmTransactionImport,
  transactionImportConfirmRequestSchema,
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
  suggestion: null,
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
        budgetLines: [],
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
        budgetLines: [],
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

describe('transactionImportConfirmRequestSchema', () => {
  const budgetId = '11111111-1111-4111-8111-111111111111';
  const lineId = '22222222-2222-4222-8222-222222222222';

  it('reads the decisions sent as a JSON multipart field', () => {
    expect(
      transactionImportConfirmRequestSchema.parse({
        budgetId,
        decisions: JSON.stringify([{ position: 3, budgetLineId: lineId }]),
      }).decisions,
    ).toEqual([{ position: 3, budgetLineId: lineId }]);
  });

  it('treats missing decisions as no attachment at all', () => {
    expect(
      transactionImportConfirmRequestSchema.parse({ budgetId }).decisions,
    ).toEqual([]);
  });

  it('refuses two decisions for one operation, and unreadable JSON', () => {
    expect(() =>
      transactionImportConfirmRequestSchema.parse({
        budgetId,
        decisions: JSON.stringify([
          { position: 3, budgetLineId: lineId },
          { position: 3, budgetLineId: lineId },
        ]),
      }),
    ).toThrow();
    expect(() =>
      transactionImportConfirmRequestSchema.parse({
        budgetId,
        decisions: '[{',
      }),
    ).toThrow();
  });
});
