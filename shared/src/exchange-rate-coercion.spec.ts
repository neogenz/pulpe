import { describe, expect, it } from 'vitest';
import {
  transactionSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
  templateLineSchema,
  templateLineCreateSchema,
  templateLineCreateWithoutTemplateIdSchema,
  templateLineUpdateSchema,
} from '../schemas.js';

// PUL-114: exchange_rate is NUMERIC(18,8) — Supabase PostgREST returns it as a
// string, so every schema that reads/writes it must coerce. A regression to
// z.number() would silently break multi-currency reads on clients that parse
// API responses with these schemas. These tests are the CI canary.

const TRANSACTION_ID = '550e8400-e29b-41d4-a716-446655440000';
const BUDGET_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEMPLATE_ID = '550e8400-e29b-41d4-a716-446655440002';
const ISO_DATETIME = '2026-01-01T00:00:00+00:00';

const baseTransaction = {
  id: TRANSACTION_ID,
  budgetId: BUDGET_ID,
  budgetLineId: null,
  name: 'Loyer',
  amount: 1200,
  kind: 'expense',
  transactionDate: ISO_DATETIME,
  category: null,
  createdAt: ISO_DATETIME,
  updatedAt: ISO_DATETIME,
  checkedAt: null,
};

const baseTemplateLine = {
  id: TRANSACTION_ID,
  templateId: TEMPLATE_ID,
  name: 'Loyer',
  amount: 1200,
  kind: 'expense',
  recurrence: 'fixed',
  description: 'Loyer',
  createdAt: ISO_DATETIME,
  updatedAt: ISO_DATETIME,
};

const baseTransactionCreate = {
  budgetId: BUDGET_ID,
  name: 'Loyer',
  amount: 1200,
  kind: 'expense',
};

const baseTransactionUpdate = {};

const baseTemplateLineCreate = {
  templateId: TEMPLATE_ID,
  name: 'Loyer',
  amount: 1200,
  kind: 'expense',
  recurrence: 'fixed',
  description: 'Loyer',
};

const baseTemplateLineCreateWithoutTemplateId = {
  name: 'Loyer',
  amount: 1200,
  kind: 'expense',
  recurrence: 'fixed',
  description: 'Loyer',
};

const baseTemplateLineUpdate = {};

const readSchemas = [
  {
    name: 'transactionSchema',
    schema: transactionSchema,
    base: baseTransaction,
  },
  {
    name: 'templateLineSchema',
    schema: templateLineSchema,
    base: baseTemplateLine,
  },
] as const;

const writeSchemas = [
  {
    name: 'transactionCreateSchema',
    schema: transactionCreateSchema,
    base: baseTransactionCreate,
  },
  {
    name: 'transactionUpdateSchema',
    schema: transactionUpdateSchema,
    base: baseTransactionUpdate,
  },
  {
    name: 'templateLineCreateSchema',
    schema: templateLineCreateSchema,
    base: baseTemplateLineCreate,
  },
  {
    name: 'templateLineCreateWithoutTemplateIdSchema',
    schema: templateLineCreateWithoutTemplateIdSchema,
    base: baseTemplateLineCreateWithoutTemplateId,
  },
  {
    name: 'templateLineUpdateSchema',
    schema: templateLineUpdateSchema,
    base: baseTemplateLineUpdate,
  },
] as const;

describe('PUL-114 exchangeRate coercion regression', () => {
  describe.each(readSchemas)(
    '$name (read: nullable + optional coerce)',
    ({ schema, base }) => {
      it('should coerce string "1.08" to number 1.08', () => {
        const result = schema.parse({ ...base, exchangeRate: '1.08' });

        expect(result.exchangeRate).toBe(1.08);
        expect(typeof result.exchangeRate).toBe('number');
      });

      it('should pass through number 1.08 unchanged', () => {
        const result = schema.parse({ ...base, exchangeRate: 1.08 });

        expect(result.exchangeRate).toBe(1.08);
        expect(typeof result.exchangeRate).toBe('number');
      });

      it('should accept null for mono-currency rows', () => {
        const result = schema.parse({ ...base, exchangeRate: null });

        expect(result.exchangeRate).toBeNull();
      });

      it('should accept missing exchangeRate (optional)', () => {
        const result = schema.parse(base);

        expect(result.exchangeRate).toBeUndefined();
      });

      it('should reject non-numeric string "abc"', () => {
        const result = schema.safeParse({ ...base, exchangeRate: 'abc' });

        expect(result.success).toBe(false);
      });
    },
  );

  describe.each(writeSchemas)(
    '$name (write: positive + optional coerce)',
    ({ schema, base }) => {
      it('should coerce string "1.08" to number 1.08', () => {
        const result = schema.parse({ ...base, exchangeRate: '1.08' });

        expect(result.exchangeRate).toBe(1.08);
        expect(typeof result.exchangeRate).toBe('number');
      });

      it('should pass through number 1.08 unchanged', () => {
        const result = schema.parse({ ...base, exchangeRate: 1.08 });

        expect(result.exchangeRate).toBe(1.08);
        expect(typeof result.exchangeRate).toBe('number');
      });

      it('should reject string "0" (coerced to zero, fails .positive())', () => {
        const result = schema.safeParse({ ...base, exchangeRate: '0' });

        expect(result.success).toBe(false);
      });

      it('should reject literal number 0 (native path, fails .positive())', () => {
        const result = schema.safeParse({ ...base, exchangeRate: 0 });

        expect(result.success).toBe(false);
      });

      it('should reject negative string "-1.5"', () => {
        const result = schema.safeParse({ ...base, exchangeRate: '-1.5' });

        expect(result.success).toBe(false);
      });

      it('should accept missing exchangeRate (optional)', () => {
        const result = schema.parse(base);

        expect(result.exchangeRate).toBeUndefined();
      });

      it('should reject non-numeric string "abc"', () => {
        const result = schema.safeParse({ ...base, exchangeRate: 'abc' });

        expect(result.success).toBe(false);
      });
    },
  );
});
