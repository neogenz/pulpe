import { describe, it, expect } from 'bun:test';
import {
  createBudgetLineSpreadItemSchema,
  createBudgetLineSpreadListSchema,
} from './rpc-payload.schemas';

const validItem = {
  budget_id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Prime assurance',
  amount: 'AES-cipher-amount',
  kind: 'expense',
  recurrence: 'one_off',
  savings_goal_id: null,
  original_amount: null,
  original_currency: null,
  target_currency: null,
  exchange_rate: null,
};

describe('createBudgetLineSpreadItemSchema', () => {
  it('accepts a valid ciphertext tranche', () => {
    expect(() =>
      createBudgetLineSpreadItemSchema.parse(validItem),
    ).not.toThrow();
  });

  it('rejects an unknown key (strict — a typo must not silently NULL a column)', () => {
    expect(() =>
      createBudgetLineSpreadItemSchema.parse({
        ...validItem,
        spread_group_id: '123e4567-e89b-12d3-a456-426614174000',
      }),
    ).toThrow();
  });

  it('rejects an empty amount ciphertext', () => {
    expect(() =>
      createBudgetLineSpreadItemSchema.parse({ ...validItem, amount: '' }),
    ).toThrow();
  });

  it('accepts frozen FX metadata', () => {
    expect(() =>
      createBudgetLineSpreadItemSchema.parse({
        ...validItem,
        original_amount: 'AES-cipher-original',
        original_currency: 'EUR',
        target_currency: 'CHF',
        exchange_rate: 0.96,
      }),
    ).not.toThrow();
  });

  it('validates a list of tranches', () => {
    expect(createBudgetLineSpreadListSchema.parse([validItem])).toHaveLength(1);
  });
});
