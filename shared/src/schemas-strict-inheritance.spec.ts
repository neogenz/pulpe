import { describe, expect, test } from 'vitest';
import {
  budgetLineUpdateSchema,
  templateLineUpdateWithIdSchema,
  savingsGoalUpdateSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
} from '../schemas.js';

const UUID = '00000000-0000-0000-0000-000000000000';

function expectUnrecognizedKeys(result: {
  success: boolean;
  error?: { issues: { code: string }[] };
}): void {
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(
      result.error!.issues.some((i) => i.code === 'unrecognized_keys'),
    ).toBe(true);
  }
}

describe('derived write schemas preserve strict inheritance', () => {
  test('budgetLineUpdateSchema rejects unknown field', () => {
    const result = budgetLineUpdateSchema.safeParse({
      id: UUID,
      name: 'x',
      unknownField: 'z',
    });

    expectUnrecognizedKeys(result);
  });

  test('budgetLineUpdateSchema accepts valid fields', () => {
    const result = budgetLineUpdateSchema.safeParse({
      id: UUID,
      name: 'x',
    });

    expect(result.success).toBe(true);
  });

  test('templateLineUpdateWithIdSchema rejects unknown field', () => {
    const result = templateLineUpdateWithIdSchema.safeParse({
      id: UUID,
      name: 'x',
      unknownField: 'z',
    });

    expectUnrecognizedKeys(result);
  });

  test('templateLineUpdateWithIdSchema accepts valid fields', () => {
    const result = templateLineUpdateWithIdSchema.safeParse({
      id: UUID,
      name: 'x',
    });

    expect(result.success).toBe(true);
  });

  test('savingsGoalUpdateSchema rejects unknown field', () => {
    const result = savingsGoalUpdateSchema.safeParse({
      name: 'x',
      unknownField: 'z',
    });

    expectUnrecognizedKeys(result);
  });

  test('savingsGoalUpdateSchema accepts valid fields', () => {
    const result = savingsGoalUpdateSchema.safeParse({
      name: 'x',
    });

    expect(result.success).toBe(true);
  });

  test('transactionCreateSchema keeps rejecting unknown fields after the source refinement', () => {
    const result = transactionCreateSchema.safeParse({
      budgetId: UUID,
      name: 'x',
      amount: 1,
      kind: 'income',
      unknownField: 'z',
    });

    expectUnrecognizedKeys(result);
  });

  test('transactionCreateSchema still exposes its field shape', () => {
    const result = transactionCreateSchema.shape.transactionDate.safeParse(
      '2026-08-02T10:00:00+02:00',
    );

    expect(result.success).toBe(true);
  });

  test('transactionUpdateSchema rejects the immutable source link', () => {
    const result = transactionUpdateSchema.safeParse({
      name: 'x',
      sourceSavingsGoalId: UUID,
    });

    expectUnrecognizedKeys(result);
  });
});
