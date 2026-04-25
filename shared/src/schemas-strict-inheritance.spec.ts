import { describe, expect, test } from 'vitest';
import {
  budgetLineUpdateSchema,
  templateLineUpdateWithIdSchema,
  templateLinesBulkUpdateSchema,
  savingsGoalUpdateSchema,
} from '../schemas.js';

const UUID = '00000000-0000-0000-0000-000000000000';

describe('derived write schemas preserve strict inheritance', () => {
  test('budgetLineUpdateSchema rejects unknown field', () => {
    const result = budgetLineUpdateSchema.safeParse({
      id: UUID,
      name: 'x',
      unknownField: 'z',
    });

    expect(result.success).toBe(false);
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

    expect(result.success).toBe(false);
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

    expect(result.success).toBe(false);
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

    expect(result.success).toBe(false);
  });
});
