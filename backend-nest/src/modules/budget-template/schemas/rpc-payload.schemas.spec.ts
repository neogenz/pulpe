import { describe, it, expect } from 'bun:test';
import {
  applyTemplateLineOperationsItemSchema,
  applyTemplateLineOperationsListSchema,
  createTemplateLineRpcPayloadSchema,
  createTemplateLinesRpcPayloadSchema,
} from './rpc-payload.schemas';

const VALID_CIPHERTEXT =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

describe('createTemplateLineRpcPayloadSchema', () => {
  it('should accept a valid payload', () => {
    const payload = {
      name: 'Rent',
      amount: VALID_CIPHERTEXT,
      kind: 'expense' as const,
      recurrence: 'fixed' as const,
      description: 'Monthly',
    };

    const result = createTemplateLineRpcPayloadSchema.parse(payload);

    expect(result).toEqual(payload);
  });

  it('should reject extra keys (forged bypass attempt)', () => {
    const forged = {
      name: 'Rent',
      amount: VALID_CIPHERTEXT,
      kind: 'expense' as const,
      recurrence: 'fixed' as const,
      description: 'Monthly',
      user_id: 'attacker',
    };

    expect(() => createTemplateLineRpcPayloadSchema.parse(forged)).toThrow();
  });

  it('should reject invalid kind', () => {
    const bad = {
      name: 'Rent',
      amount: VALID_CIPHERTEXT,
      kind: 'transfer',
      recurrence: 'fixed' as const,
      description: '',
    };

    expect(() => createTemplateLineRpcPayloadSchema.parse(bad)).toThrow();
  });

  it('should reject plaintext numeric amount (must be encrypted ciphertext)', () => {
    const bad = {
      name: 'Rent',
      amount: 1500,
      kind: 'expense' as const,
      recurrence: 'fixed' as const,
      description: '',
    };

    expect(() => createTemplateLineRpcPayloadSchema.parse(bad)).toThrow();
  });
});

describe('createTemplateLinesRpcPayloadSchema', () => {
  it('should validate an array of payloads', () => {
    const payloads = [
      {
        name: 'Rent',
        amount: VALID_CIPHERTEXT,
        kind: 'expense' as const,
        recurrence: 'fixed' as const,
        description: '',
      },
    ];

    const result = createTemplateLinesRpcPayloadSchema.parse(payloads);

    expect(result).toHaveLength(1);
  });
});

describe('applyTemplateLineOperationsItemSchema', () => {
  const base = {
    id: '8a0f6c80-1234-4e5f-89ab-111111111111',
    name: 'Rent',
    amount: VALID_CIPHERTEXT,
    kind: 'expense' as const,
    recurrence: 'fixed' as const,
    original_amount: null,
    original_currency: null,
    target_currency: null,
    exchange_rate: null,
  };

  it('should accept a valid mono-currency payload', () => {
    const result = applyTemplateLineOperationsItemSchema.parse(base);
    expect(result).toEqual(base);
  });

  it('should accept a valid multi-currency payload', () => {
    const payload = {
      ...base,
      original_amount: VALID_CIPHERTEXT,
      original_currency: 'EUR' as const,
      target_currency: 'CHF' as const,
      exchange_rate: 0.94,
    };

    const result = applyTemplateLineOperationsItemSchema.parse(payload);

    expect(result.exchange_rate).toBe(0.94);
    expect(result.original_currency).toBe('EUR');
  });

  it('should reject extra keys (forged bypass attempt)', () => {
    const forged = { ...base, template_id: 'attacker' };

    expect(() => applyTemplateLineOperationsItemSchema.parse(forged)).toThrow();
  });

  it('should reject unsupported currency', () => {
    const bad = { ...base, original_currency: 'USD', target_currency: 'CHF' };

    expect(() => applyTemplateLineOperationsItemSchema.parse(bad)).toThrow();
  });

  it('should reject non-uuid id', () => {
    const bad = { ...base, id: 'not-a-uuid' };

    expect(() => applyTemplateLineOperationsItemSchema.parse(bad)).toThrow();
  });

  it('should reject negative exchange rate', () => {
    const bad = {
      ...base,
      original_currency: 'CHF' as const,
      target_currency: 'EUR' as const,
      exchange_rate: -1,
    };

    expect(() => applyTemplateLineOperationsItemSchema.parse(bad)).toThrow();
  });

  it('should reject non-finite exchange rate', () => {
    const bad = {
      ...base,
      original_currency: 'CHF' as const,
      target_currency: 'EUR' as const,
      exchange_rate: Number.POSITIVE_INFINITY,
    };

    expect(() => applyTemplateLineOperationsItemSchema.parse(bad)).toThrow();
  });

  it('should accept null amount (DB allows null)', () => {
    const payload = { ...base, amount: null };

    const result = applyTemplateLineOperationsItemSchema.parse(payload);

    expect(result.amount).toBeNull();
  });
});

describe('applyTemplateLineOperationsListSchema', () => {
  it('should accept an empty list', () => {
    const result = applyTemplateLineOperationsListSchema.parse([]);
    expect(result).toEqual([]);
  });

  it('should reject when any item has extras', () => {
    const list = [
      {
        id: '8a0f6c80-1234-4e5f-89ab-111111111111',
        name: 'Rent',
        amount: VALID_CIPHERTEXT,
        kind: 'expense',
        recurrence: 'fixed',
        original_amount: null,
        original_currency: null,
        target_currency: null,
        exchange_rate: null,
        attacker: true,
      },
    ];

    expect(() => applyTemplateLineOperationsListSchema.parse(list)).toThrow();
  });
});
