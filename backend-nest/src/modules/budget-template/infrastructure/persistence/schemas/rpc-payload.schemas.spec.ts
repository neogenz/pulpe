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
  const monoBase = {
    name: 'Rent',
    amount: VALID_CIPHERTEXT,
    kind: 'expense' as const,
    recurrence: 'fixed' as const,
    description: 'Monthly',
    original_amount: null,
    original_currency: null,
    target_currency: null,
    exchange_rate: null,
  };

  it('should accept a valid mono-currency payload', () => {
    const result = createTemplateLineRpcPayloadSchema.parse(monoBase);

    expect(result).toEqual(monoBase);
  });

  it('should accept a valid multi-currency payload (PUL-133)', () => {
    const payload = {
      ...monoBase,
      original_amount: VALID_CIPHERTEXT,
      original_currency: 'EUR' as const,
      target_currency: 'CHF' as const,
      exchange_rate: 0.94,
    };

    const result = createTemplateLineRpcPayloadSchema.parse(payload);

    expect(result.exchange_rate).toBe(0.94);
    expect(result.original_currency).toBe('EUR');
  });

  it('should reject extra keys (forged bypass attempt)', () => {
    const forged = { ...monoBase, user_id: 'attacker' };

    expect(() => createTemplateLineRpcPayloadSchema.parse(forged)).toThrow();
  });

  it('should reject invalid kind', () => {
    const bad = { ...monoBase, kind: 'transfer' };

    expect(() => createTemplateLineRpcPayloadSchema.parse(bad)).toThrow();
  });

  it('should reject plaintext numeric amount (must be encrypted ciphertext)', () => {
    const bad = { ...monoBase, amount: 1500 };

    expect(() => createTemplateLineRpcPayloadSchema.parse(bad)).toThrow();
  });

  it('should reject unsupported currency (PUL-133)', () => {
    const bad = {
      ...monoBase,
      original_currency: 'USD',
      target_currency: 'CHF',
    };

    expect(() => createTemplateLineRpcPayloadSchema.parse(bad)).toThrow();
  });

  it('should reject negative exchange rate (PUL-133)', () => {
    const bad = {
      ...monoBase,
      original_currency: 'EUR' as const,
      target_currency: 'CHF' as const,
      exchange_rate: -1,
    };

    expect(() => createTemplateLineRpcPayloadSchema.parse(bad)).toThrow();
  });

  it('should reject non-finite exchange rate (PUL-133)', () => {
    const bad = {
      ...monoBase,
      original_currency: 'EUR' as const,
      target_currency: 'CHF' as const,
      exchange_rate: Number.POSITIVE_INFINITY,
    };

    expect(() => createTemplateLineRpcPayloadSchema.parse(bad)).toThrow();
  });

  it('should accept PostgREST string exchange_rate "1.05000000" (PUL-182)', () => {
    const payload = {
      ...monoBase,
      original_amount: VALID_CIPHERTEXT,
      original_currency: 'EUR' as const,
      target_currency: 'CHF' as const,
      exchange_rate: '1.05000000',
    };

    const result = createTemplateLineRpcPayloadSchema.parse(payload);

    expect(result.exchange_rate).toBe(1.05);
    expect(typeof result.exchange_rate).toBe('number');
  });

  describe('non-numeric exchange_rate (PUL-114 hardening)', () => {
    const cases: ReadonlyArray<{ label: string; value: unknown }> = [
      { label: 'boolean true', value: true },
      { label: 'array ["1.2"]', value: ['1.2'] },
      { label: 'unparseable string', value: 'not-a-number' },
      { label: 'empty string', value: '' },
    ];

    for (const { label, value } of cases) {
      it(`should reject ${label}`, () => {
        const bad = {
          ...monoBase,
          original_currency: 'EUR' as const,
          target_currency: 'CHF' as const,
          exchange_rate: value,
        };

        expect(() => createTemplateLineRpcPayloadSchema.parse(bad)).toThrow();
      });
    }
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
        original_amount: null,
        original_currency: null,
        target_currency: null,
        exchange_rate: null,
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

  it('should accept PostgREST string exchange_rate "1.05000000" (PUL-182)', () => {
    const payload = {
      ...base,
      original_amount: VALID_CIPHERTEXT,
      original_currency: 'EUR' as const,
      target_currency: 'CHF' as const,
      exchange_rate: '1.05000000',
    };

    const result = applyTemplateLineOperationsItemSchema.parse(payload);

    expect(result.exchange_rate).toBe(1.05);
    expect(typeof result.exchange_rate).toBe('number');
  });

  describe('non-numeric exchange_rate (PUL-114 hardening)', () => {
    const cases: ReadonlyArray<{ label: string; value: unknown }> = [
      { label: 'boolean true', value: true },
      { label: 'array ["1.2"]', value: ['1.2'] },
      { label: 'unparseable string', value: 'not-a-number' },
      { label: 'empty string', value: '' },
    ];

    for (const { label, value } of cases) {
      it(`should reject ${label}`, () => {
        const bad = {
          ...base,
          original_currency: 'EUR' as const,
          target_currency: 'CHF' as const,
          exchange_rate: value,
        };

        expect(() =>
          applyTemplateLineOperationsItemSchema.parse(bad),
        ).toThrow();
      });
    }
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
