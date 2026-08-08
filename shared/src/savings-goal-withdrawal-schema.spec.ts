import { describe, expect, it } from 'vitest';
import {
  savingsGoalWithdrawalOptionSchema,
  savingsGoalWithdrawalsResponseSchema,
  savingsGoalWithdrawalSchema,
  transactionCreateSchema,
  transactionSchema,
  transactionUpdateSchema,
} from '../schemas.js';

const GOAL_ID = '123e4567-e89b-12d3-a456-426614174000';
const BUDGET_ID = '223e4567-e89b-12d3-a456-426614174000';
const TRANSACTION_ID = '323e4567-e89b-12d3-a456-426614174000';
const BUDGET_LINE_ID = '423e4567-e89b-12d3-a456-426614174000';
const NOW = '2026-08-02T10:00:00+02:00';

const buildCreatePayload = (overrides: Record<string, unknown> = {}) => ({
  budgetId: BUDGET_ID,
  name: 'Achat vélo',
  amount: 4500,
  kind: 'income',
  ...overrides,
});

const buildTransaction = (overrides: Record<string, unknown> = {}) => ({
  id: TRANSACTION_ID,
  budgetId: BUDGET_ID,
  budgetLineId: null,
  name: 'Achat vélo',
  amount: 4500,
  kind: 'income',
  transactionDate: NOW,
  createdAt: NOW,
  updatedAt: NOW,
  checkedAt: null,
  ...overrides,
});

describe('transactionCreateSchema source link', () => {
  it('should accept a free income carrying exactly one source goal', () => {
    const result = transactionCreateSchema.safeParse(
      buildCreatePayload({ sourceSavingsGoalId: GOAL_ID }),
    );

    expect(result.success).toBe(true);
  });

  it('should accept a transaction without any source goal', () => {
    const result = transactionCreateSchema.safeParse(buildCreatePayload());

    expect(result.success).toBe(true);
  });

  it.each(['expense', 'saving'] as const)(
    'should reject a %s carrying a source goal',
    (kind) => {
      const result = transactionCreateSchema.safeParse(
        buildCreatePayload({ kind, sourceSavingsGoalId: GOAL_ID }),
      );

      expect(result.success).toBe(false);
    },
  );

  it('should reject an allocated income carrying a source goal', () => {
    const result = transactionCreateSchema.safeParse(
      buildCreatePayload({
        budgetLineId: BUDGET_LINE_ID,
        sourceSavingsGoalId: GOAL_ID,
      }),
    );

    expect(result.success).toBe(false);
  });

  it('should reject a non-positive amount on a linked income', () => {
    const result = transactionCreateSchema.safeParse(
      buildCreatePayload({ amount: 0, sourceSavingsGoalId: GOAL_ID }),
    );

    expect(result.success).toBe(false);
  });

  it('should reject the server-owned name snapshot from the client', () => {
    const result = transactionCreateSchema.safeParse(
      buildCreatePayload({
        sourceSavingsGoalId: GOAL_ID,
        sourceSavingsGoalName: 'Maison',
      }),
    );

    expect(result.success).toBe(false);
  });
});

describe('transactionUpdateSchema keeps the source link immutable', () => {
  it('should reject an attempt to set a source goal', () => {
    const result = transactionUpdateSchema.safeParse({
      sourceSavingsGoalId: GOAL_ID,
    });

    expect(result.success).toBe(false);
  });

  it('should reject an attempt to clear a source goal', () => {
    const result = transactionUpdateSchema.safeParse({
      sourceSavingsGoalId: null,
    });

    expect(result.success).toBe(false);
  });

  it('should reject an attempt to rewrite the name snapshot', () => {
    const result = transactionUpdateSchema.safeParse({
      sourceSavingsGoalName: 'Autre objectif',
    });

    expect(result.success).toBe(false);
  });

  it('should still accept the editable fields', () => {
    const result = transactionUpdateSchema.safeParse({
      name: 'Achat vélo électrique',
      amount: 3500,
    });

    expect(result.success).toBe(true);
  });
});

describe('transactionSchema source states', () => {
  it('should read an active link as id plus name', () => {
    const result = transactionSchema.safeParse(
      buildTransaction({
        sourceSavingsGoalId: GOAL_ID,
        sourceSavingsGoalName: 'Maison',
      }),
    );

    expect(result.success).toBe(true);
  });

  it('should read a broken link as a null id keeping the last name', () => {
    const result = transactionSchema.safeParse(
      buildTransaction({
        sourceSavingsGoalId: null,
        sourceSavingsGoalName: 'Maison',
      }),
    );

    expect(result.success).toBe(true);
  });

  it('should read an ordinary transaction with both fields null', () => {
    const result = transactionSchema.safeParse(
      buildTransaction({
        sourceSavingsGoalId: null,
        sourceSavingsGoalName: null,
      }),
    );

    expect(result.success).toBe(true);
  });

  it('should read a response that omits both fields', () => {
    const result = transactionSchema.safeParse(buildTransaction());

    expect(result.success).toBe(true);
  });

  it('should reject an empty name snapshot', () => {
    const result = transactionSchema.safeParse(
      buildTransaction({
        sourceSavingsGoalId: GOAL_ID,
        sourceSavingsGoalName: '',
      }),
    );

    expect(result.success).toBe(false);
  });
});

describe('savingsGoalWithdrawalOptionSchema', () => {
  const buildOption = (overrides: Record<string, unknown> = {}) => ({
    goalId: GOAL_ID,
    name: 'Maison',
    status: 'ACTIVE',
    availableAmount: 10000,
    currency: 'CHF',
    ...overrides,
  });

  it.each(['ACTIVE', 'PAUSED', 'COMPLETED'] as const)(
    'should accept an eligible goal with status %s',
    (status) => {
      const result = savingsGoalWithdrawalOptionSchema.safeParse(
        buildOption({ status }),
      );

      expect(result.success).toBe(true);
    },
  );

  it('should reject an empty balance', () => {
    const result = savingsGoalWithdrawalOptionSchema.safeParse(
      buildOption({ availableAmount: 0 }),
    );

    expect(result.success).toBe(false);
  });
});

describe('savingsGoalWithdrawalSchema', () => {
  const buildWithdrawal = (overrides: Record<string, unknown> = {}) => ({
    transactionId: TRANSACTION_ID,
    budgetId: BUDGET_ID,
    name: 'Achat vélo',
    transactionDate: NOW,
    amount: 4500,
    ...overrides,
  });

  it('should accept a withdrawal carrying its transaction and budget', () => {
    const result = savingsGoalWithdrawalSchema.safeParse(buildWithdrawal());

    expect(result.success).toBe(true);
  });

  it('should expose the allocated Real pointing state when present', () => {
    const result = savingsGoalWithdrawalSchema.safeParse(
      buildWithdrawal({
        budgetLineId: BUDGET_LINE_ID,
        checkedAt: NOW,
      }),
    );

    expect(result.success).toBe(true);
  });

  it('should reject a negative transport amount', () => {
    const result = savingsGoalWithdrawalSchema.safeParse(
      buildWithdrawal({ amount: -4500 }),
    );

    expect(result.success).toBe(false);
  });

  it('should accept a zero amount so an undecryptable row degrades instead of failing the payload', () => {
    const result = savingsGoalWithdrawalSchema.safeParse(
      buildWithdrawal({ amount: 0 }),
    );

    expect(result.success).toBe(true);
  });
});

describe('savingsGoalWithdrawalsResponseSchema', () => {
  it('keeps an old server response readable with no planned field', () => {
    const result = savingsGoalWithdrawalsResponseSchema.parse({
      success: true,
      data: [],
    });

    expect(result.planned).toEqual([]);
  });

  it('reads planned, partial and realized amounts additively', () => {
    const result = savingsGoalWithdrawalsResponseSchema.parse({
      success: true,
      data: [],
      planned: [
        {
          budgetLineId: BUDGET_LINE_ID,
          budgetId: BUDGET_ID,
          name: 'Achat vélo',
          month: 9,
          year: 2026,
          plannedAmount: 4_500,
          realizedAmount: 1_500,
          remainingAmount: 3_000,
          status: 'partially_realized',
        },
      ],
    });

    expect(result.planned[0]).toMatchObject({
      realizedAmount: 1_500,
      remainingAmount: 3_000,
      status: 'partially_realized',
    });
  });
});
