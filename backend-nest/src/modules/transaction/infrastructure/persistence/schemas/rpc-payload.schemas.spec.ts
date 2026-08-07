import { describe, it, expect } from 'bun:test';
import {
  createSavingsGoalWithdrawalPayloadSchema,
  updateSavingsGoalWithdrawalPayloadSchema,
} from './rpc-payload.schemas';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const DATE = '2026-08-02T12:00:00+00:00';

const validCreate = {
  budget_id: UUID,
  budget_line_id: null,
  name: 'Retrait Maison',
  amount: 'AES-cipher-amount',
  original_amount: null,
  original_currency: null,
  target_currency: null,
  exchange_rate: null,
  kind: 'income' as const,
  transaction_date: DATE,
  checked_at: null,
};

describe('createSavingsGoalWithdrawalPayloadSchema', () => {
  it('accepts an encrypted withdrawal row', () => {
    expect(() =>
      createSavingsGoalWithdrawalPayloadSchema.parse(validCreate),
    ).not.toThrow();
  });

  it('rejects a plaintext amount', () => {
    expect(() =>
      createSavingsGoalWithdrawalPayloadSchema.parse({
        ...validCreate,
        amount: 4500,
      }),
    ).toThrow();
  });

  it('rejects a kind other than income', () => {
    expect(() =>
      createSavingsGoalWithdrawalPayloadSchema.parse({
        ...validCreate,
        kind: 'expense',
      }),
    ).toThrow();
  });

  it('carries the allocation of a realized planned withdrawal', () => {
    expect(
      createSavingsGoalWithdrawalPayloadSchema.parse({
        ...validCreate,
        budget_line_id: UUID,
      }).budget_line_id,
    ).toBe(UUID);
  });

  it('rejects the goal columns the RPC posts itself', () => {
    expect(() =>
      createSavingsGoalWithdrawalPayloadSchema.parse({
        ...validCreate,
        source_savings_goal_id: UUID,
      }),
    ).toThrow();
  });

  it('rejects an unknown key (strict — a typo must not silently NULL a column)', () => {
    expect(() =>
      createSavingsGoalWithdrawalPayloadSchema.parse({
        ...validCreate,
        amount_: 'AES-cipher-amount',
      }),
    ).toThrow();
  });
});

describe('updateSavingsGoalWithdrawalPayloadSchema', () => {
  it('accepts a partial patch', () => {
    expect(
      updateSavingsGoalWithdrawalPayloadSchema.parse({
        name: 'Retrait Maison',
      }),
    ).toEqual({ name: 'Retrait Maison' });
  });

  it('rejects kind — a withdrawal never changes nature, and the RPC does not write it', () => {
    expect(() =>
      updateSavingsGoalWithdrawalPayloadSchema.parse({
        name: 'Retrait Maison',
        kind: 'income',
      }),
    ).toThrow();
  });

  it('rejects an allocation change — it is decided at creation, never moved', () => {
    expect(() =>
      updateSavingsGoalWithdrawalPayloadSchema.parse({
        budget_line_id: UUID,
      }),
    ).toThrow();
  });

  it('rejects a plaintext amount', () => {
    expect(() =>
      updateSavingsGoalWithdrawalPayloadSchema.parse({ amount: 4500 }),
    ).toThrow();
  });

  it('accepts a nullable ciphertext being cleared', () => {
    expect(
      updateSavingsGoalWithdrawalPayloadSchema.parse({
        original_amount: null,
        original_currency: null,
      }),
    ).toEqual({ original_amount: null, original_currency: null });
  });

  it('rejects a non-uuid budget_id', () => {
    expect(() =>
      updateSavingsGoalWithdrawalPayloadSchema.parse({
        budget_id: 'not-a-uuid',
      }),
    ).toThrow();
  });
});
