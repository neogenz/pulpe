import { describe, it, expect } from 'bun:test';
import { TRANSACTION_IMPORT_MAX_OPERATIONS } from 'pulpe-shared';
import type {
  BankStatement,
  StatementOperation,
} from './bank-statement.entity';
import {
  budgetPeriodBounds,
  classifyOperations,
  findStatementErrors,
  fingerprintMaterials,
  toTransactionDate,
  validateOperations,
  type ValidOperation,
} from './transaction-import.formulas';

const operation = (
  overrides: Partial<StatementOperation> = {},
): StatementOperation => ({
  position: 1,
  date: '2026-03-10',
  amount: 12.5,
  currency: 'CHF',
  direction: 'expense',
  label: 'Boulangerie',
  isBooked: true,
  bankReference: null,
  accountId: 'CH93',
  ...overrides,
});

const valid = (overrides: Partial<ValidOperation> = {}): ValidOperation => ({
  position: 1,
  date: '2026-03-10',
  amount: 12.5,
  kind: 'expense',
  name: 'Boulangerie',
  isBooked: true,
  bankReference: null,
  accountId: 'CH93',
  ...overrides,
});

const statement = (operations: StatementOperation[]): BankStatement => ({
  format: 'camt053',
  operations,
});

const MARCH = { startDate: '2026-03-01', endDate: '2026-03-31' };

describe('budgetPeriodBounds', () => {
  it('follows the calendar month without a pay day', () => {
    expect(budgetPeriodBounds(2, 2026, null)).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
  });

  it('follows the pay day rule', () => {
    expect(budgetPeriodBounds(3, 2026, 27)).toEqual({
      startDate: '2026-02-27',
      endDate: '2026-03-26',
    });
  });
});

describe('findStatementErrors', () => {
  it('refuses an empty statement', () => {
    expect(findStatementErrors(statement([]))).toEqual([
      { code: 'empty_statement', position: null },
    ]);
  });

  it('refuses a statement over the operation ceiling', () => {
    const operations = Array.from(
      { length: TRANSACTION_IMPORT_MAX_OPERATIONS + 1 },
      (_, index) => operation({ position: index + 1 }),
    );
    expect(findStatementErrors(statement(operations))).toEqual([
      { code: 'too_many_operations', position: null },
    ]);
  });
});

describe('validateOperations', () => {
  it('normalises a readable operation into a Réel-ready one', () => {
    const { valid: result, errors } = validateOperations(
      [
        operation({
          amount: 12.499,
          direction: 'income',
          label: '  Remboursement \n  repas ',
        }),
      ],
      'CHF',
    );

    expect(errors).toEqual([]);
    expect(result).toEqual([
      valid({ amount: 12.5, kind: 'income', name: 'Remboursement repas' }),
    ]);
  });

  it('caps a long label to the Réel name length', () => {
    const { valid: result } = validateOperations(
      [operation({ label: 'x'.repeat(150) })],
      'CHF',
    );
    expect(result[0].name).toHaveLength(100);
    expect(result[0].name.endsWith('…')).toBe(true);
  });

  it('reports every unreadable field of an operation at its position', () => {
    const { valid: result, errors } = validateOperations(
      [
        operation({ position: 1 }),
        operation({
          position: 2,
          date: '2026-02-30',
          amount: 0.001,
          direction: null,
          label: '   ',
        }),
      ],
      'CHF',
    );

    expect(result.map((op) => op.position)).toEqual([1]);
    expect(errors).toEqual([
      { code: 'missing_date', position: 2 },
      { code: 'invalid_amount', position: 2 },
      { code: 'missing_direction', position: 2 },
      { code: 'missing_label', position: 2 },
    ]);
  });

  it('collapses a file entirely in another currency into one error', () => {
    const { errors } = validateOperations(
      [
        operation({ position: 1, currency: 'EUR' }),
        operation({ position: 2, currency: 'EUR' }),
      ],
      'CHF',
    );
    expect(errors).toEqual([{ code: 'currency_mismatch', position: null }]);
  });

  it('keeps only the file-level error when the whole file is in another currency', () => {
    const { errors } = validateOperations(
      [
        operation({ position: 1, currency: 'EUR' }),
        operation({ position: 2, currency: 'EUR', date: null }),
      ],
      'CHF',
    );
    expect(errors).toEqual([{ code: 'currency_mismatch', position: null }]);
  });

  it('points at the odd operation when only some differ', () => {
    const { errors } = validateOperations(
      [operation({ position: 1 }), operation({ position: 2, currency: 'USD' })],
      'CHF',
    );
    expect(errors).toEqual([{ code: 'currency_mismatch', position: 2 }]);
  });
});

describe('fingerprintMaterials', () => {
  const format = 'camt053' as const;

  it('prefers the bank reference over the content', () => {
    const [withReference] = fingerprintMaterials(format, [
      valid({ bankReference: 'REF-1' }),
    ]);
    const [sameReferenceOtherContent] = fingerprintMaterials(format, [
      valid({ bankReference: 'REF-1', name: 'Autre', amount: 99 }),
    ]);
    expect(withReference).toBe(sameReferenceOtherContent);
  });

  it('tells identical operations apart by their rank, stably', () => {
    const coffees = [valid({ position: 1 }), valid({ position: 2 })];
    const first = fingerprintMaterials(format, coffees);
    const again = fingerprintMaterials(format, coffees);

    expect(first[0]).not.toBe(first[1]);
    expect(again).toEqual(first);
  });

  it('separates the same reference on two accounts of one file', () => {
    const [a, b] = fingerprintMaterials(format, [
      valid({ bankReference: 'REF-1' }),
      valid({ bankReference: 'REF-1', accountId: 'CH44' }),
    ]);
    expect(a).not.toBe(b);
  });

  it('ignores label case so a re-export with other casing still matches', () => {
    const [lower] = fingerprintMaterials(format, [valid({ name: 'café' })]);
    const [upper] = fingerprintMaterials(format, [valid({ name: 'CAFÉ' })]);
    expect(lower).toBe(upper);
  });
});

describe('classifyOperations', () => {
  it('creates only booked, new operations inside the period', () => {
    const operations = [
      valid({ position: 1 }),
      valid({ position: 2, isBooked: false }),
      valid({ position: 3, date: '2026-04-01' }),
      valid({ position: 4 }),
    ];
    const { operations: listed, candidates } = classifyOperations({
      operations,
      fingerprints: ['fp1', 'fp2', 'fp3', 'fp4'],
      importedFingerprints: new Set(['fp4']),
      period: MARCH,
    });

    expect(listed.map((op) => op.status)).toEqual([
      'new',
      'pending',
      'outside_period',
      'already_imported',
    ]);
    expect(candidates).toEqual([
      {
        position: 1,
        date: '2026-03-10',
        name: 'Boulangerie',
        amount: 12.5,
        kind: 'expense',
        fingerprint: 'fp1',
      },
    ]);
  });

  it('includes both period bounds', () => {
    const { candidates } = classifyOperations({
      operations: [
        valid({ position: 1, date: '2026-03-01' }),
        valid({ position: 2, date: '2026-03-31' }),
      ],
      fingerprints: ['a', 'b'],
      importedFingerprints: new Set(),
      period: MARCH,
    });
    expect(candidates).toHaveLength(2);
  });

  it('keeps a reference listed twice in the file to a single creation', () => {
    const { operations: listed, candidates } = classifyOperations({
      operations: [valid({ position: 1 }), valid({ position: 2 })],
      fingerprints: ['same', 'same'],
      importedFingerprints: new Set(),
      period: MARCH,
    });
    expect(listed.map((op) => op.status)).toEqual(['new', 'already_imported']);
    expect(candidates).toHaveLength(1);
  });
});

describe('toTransactionDate', () => {
  it('anchors the booking day at noon UTC', () => {
    expect(toTransactionDate('2026-03-10')).toBe('2026-03-10T12:00:00.000Z');
  });
});
