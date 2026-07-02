import { describe, expect, test } from 'vitest';
import {
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
  savingsGoalSchema,
  templateLineCreateSchema,
  templateLineCreateWithoutTemplateIdSchema,
  templateLineUpdateSchema,
  templateLineSchema,
} from '../schemas.js';

const UUID = '00000000-0000-0000-0000-000000000000';

function isoDateOffsetDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('PUL-12 — savingsGoalCreateSchema', () => {
  const base = {
    name: 'Vacances 2027',
    targetAmount: 3000,
    targetDate: isoDateOffsetDays(30),
  };

  test('rejects priority (removed from product)', () => {
    const result = savingsGoalCreateSchema.safeParse({
      ...base,
      priority: 'HIGH',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.code === 'unrecognized_keys'),
      ).toBe(true);
    }
  });

  test('rejects a past targetDate', () => {
    const result = savingsGoalCreateSchema.safeParse({
      ...base,
      targetDate: isoDateOffsetDays(-1),
    });
    expect(result.success).toBe(false);
  });

  test("accepts today's date (deadline month is still contributive)", () => {
    const result = savingsGoalCreateSchema.safeParse({
      ...base,
      targetDate: isoDateOffsetDays(0),
    });
    expect(result.success).toBe(true);
  });

  test('accepts a future targetDate and defaults status to ACTIVE', () => {
    const result = savingsGoalCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('ACTIVE');
    }
  });

  test('rejects a non-ISO-date targetDate (length is not a date)', () => {
    const result = savingsGoalCreateSchema.safeParse({
      ...base,
      targetDate: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});

describe('PUL-12 — savingsGoalSchema (read) drops priority', () => {
  test('parses a row without priority', () => {
    const now = new Date().toISOString();
    const result = savingsGoalSchema.safeParse({
      id: UUID,
      userId: UUID,
      name: 'Maison',
      targetAmount: 100000,
      targetDate: isoDateOffsetDays(365),
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('priority' in result.data).toBe(false);
    }
  });
});

describe('PUL-12 — savingsGoalUpdateSchema keeps PATCH semantics', () => {
  test('does not default status to ACTIVE on partial updates', () => {
    const result = savingsGoalUpdateSchema.safeParse({ name: 'Maison bis' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('status' in result.data).toBe(false);
    }
  });

  test('accepts an existing past targetDate so expired goals stay editable', () => {
    const result = savingsGoalUpdateSchema.safeParse({
      targetDate: isoDateOffsetDays(-1),
    });
    expect(result.success).toBe(true);
  });
});

describe('PUL-12 — template line schemas carry savingsGoalId', () => {
  test('templateLineCreateSchema accepts a uuid savingsGoalId', () => {
    const result = templateLineCreateSchema.safeParse({
      templateId: UUID,
      savingsGoalId: UUID,
      name: 'Épargne maison',
      amount: 500,
      kind: 'saving',
      recurrence: 'fixed',
      description: '',
    });
    expect(result.success).toBe(true);
  });

  test('templateLineCreateSchema accepts a null savingsGoalId', () => {
    const result = templateLineCreateSchema.safeParse({
      templateId: UUID,
      savingsGoalId: null,
      name: 'Loyer',
      amount: 1500,
      kind: 'expense',
      recurrence: 'fixed',
      description: '',
    });
    expect(result.success).toBe(true);
  });

  test('templateLineCreateSchema omitting savingsGoalId is valid', () => {
    const result = templateLineCreateSchema.safeParse({
      templateId: UUID,
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
      recurrence: 'fixed',
      description: '',
    });
    expect(result.success).toBe(true);
  });

  test('templateLineCreateWithoutTemplateIdSchema accepts savingsGoalId', () => {
    const result = templateLineCreateWithoutTemplateIdSchema.safeParse({
      savingsGoalId: UUID,
      name: 'Épargne',
      amount: 200,
      kind: 'saving',
      recurrence: 'fixed',
      description: '',
    });
    expect(result.success).toBe(true);
  });

  test('templateLineUpdateSchema accepts savingsGoalId (incl. null to untag)', () => {
    expect(
      templateLineUpdateSchema.safeParse({ savingsGoalId: UUID }).success,
    ).toBe(true);
    expect(
      templateLineUpdateSchema.safeParse({ savingsGoalId: null }).success,
    ).toBe(true);
  });

  test('templateLineSchema (read) includes savingsGoalId', () => {
    const now = new Date().toISOString();
    const result = templateLineSchema.safeParse({
      id: UUID,
      templateId: UUID,
      savingsGoalId: null,
      name: 'Épargne',
      amount: 0,
      kind: 'saving',
      recurrence: 'fixed',
      description: '',
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });
});
