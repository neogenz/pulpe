import { describe, expect, test } from 'vitest';
import {
  budgetLineUpdateSchema,
  templateLineUpdateWithIdSchema,
  templateLinesBulkUpdateSchema,
  savingsGoalUpdateSchema,
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

  test('templateLinesBulkUpdateSchema rejects unknown field at element level', () => {
    const result = templateLinesBulkUpdateSchema.safeParse({
      lines: [{ id: UUID, name: 'x', unknownField: 'z' }],
    });

    expectUnrecognizedKeys(result);
  });

  test('templateLinesBulkUpdateSchema rejects unknown field on outer wrapper', () => {
    const result = templateLinesBulkUpdateSchema.safeParse({
      lines: [{ id: UUID, name: 'x' }],
      unknownOuterField: 'z',
    });

    expectUnrecognizedKeys(result);
  });
});
