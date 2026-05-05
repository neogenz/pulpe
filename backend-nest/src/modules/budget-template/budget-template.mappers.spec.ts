import { describe, it, expect } from 'bun:test';
import { templateLineSchema, type TemplateLineUpdate } from 'pulpe-shared';
import {
  toApiTemplateLine,
  toApiTemplateLineList,
  toDbTemplateLineUpdate,
  type DecryptedTemplateLineRow,
} from './budget-template.mappers';

describe('BudgetTemplate Mappers', () => {
  describe('toApiTemplateLine', () => {
    it('should map all fields from DB row to API entity', () => {
      const dbRow: DecryptedTemplateLineRow = {
        id: 'line-123',
        template_id: 'template-123',
        name: 'Salaire',
        amount: 5000,
        kind: 'income',
        recurrence: 'fixed',
        description: 'Salaire mensuel',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        original_amount: null,
        original_currency: null,
        target_currency: null,
        exchange_rate: null,
      };

      const result = toApiTemplateLine(dbRow);

      expect(result.id).toBe('line-123');
      expect(result.templateId).toBe('template-123');
      expect(result.name).toBe('Salaire');
      expect(result.amount).toBe(5000);
      expect(result.kind).toBe('income');
      expect(result.recurrence).toBe('fixed');
    });
  });

  describe('toApiTemplateLineList', () => {
    it('should map all rows', () => {
      const dbRows: DecryptedTemplateLineRow[] = [
        {
          id: 'line-1',
          template_id: 'template-123',
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
          recurrence: 'fixed',
          description: '',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          original_amount: null,
          original_currency: null,
          target_currency: null,
          exchange_rate: null,
        },
        {
          id: 'line-2',
          template_id: 'template-123',
          name: 'Loyer',
          amount: 1200.5,
          kind: 'expense',
          recurrence: 'fixed',
          description: '',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          original_amount: null,
          original_currency: null,
          target_currency: null,
          exchange_rate: null,
        },
      ];

      const results = toApiTemplateLineList(dbRows);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Salaire');
      expect(results[1].name).toBe('Loyer');
    });
  });

  describe('toDbTemplateLineUpdate', () => {
    it('should not write any currency columns when no currency fields are provided (mono-currency PATCH)', () => {
      const dto: TemplateLineUpdate = { name: 'Netflix' };

      const result = toDbTemplateLineUpdate(dto);

      expect(result).toEqual({ name: 'Netflix' });
      expect(result).not.toHaveProperty('original_currency');
      expect(result).not.toHaveProperty('target_currency');
      expect(result).not.toHaveProperty('exchange_rate');
    });

    it('should only write exchange_rate when a partial currency PATCH touches only the rate (PUL-99 CA4 regression)', () => {
      const dto: TemplateLineUpdate = { exchangeRate: 1.08 };

      const result = toDbTemplateLineUpdate(dto);

      expect(result).toEqual({ exchange_rate: 1.08 });
      expect(result).not.toHaveProperty('original_currency');
      expect(result).not.toHaveProperty('target_currency');
    });

    it('should only write original_currency when only originalCurrency is set', () => {
      const dto: TemplateLineUpdate = { originalCurrency: 'EUR' };

      const result = toDbTemplateLineUpdate(dto);

      expect(result).toEqual({ original_currency: 'EUR' });
      expect(result).not.toHaveProperty('target_currency');
      expect(result).not.toHaveProperty('exchange_rate');
    });

    it('should write all three currency columns when the full currency metadata is provided', () => {
      const dto: TemplateLineUpdate = {
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 1.05,
      };

      const result = toDbTemplateLineUpdate(dto);

      expect(result).toEqual({
        original_currency: 'EUR',
        target_currency: 'CHF',
        exchange_rate: 1.05,
      });
    });

    it('should combine non-currency fields with the currency metadata partial', () => {
      const dto: TemplateLineUpdate = {
        name: 'Netflix EU',
        originalCurrency: 'EUR',
      };

      const result = toDbTemplateLineUpdate(dto);

      expect(result).toEqual({
        name: 'Netflix EU',
        original_currency: 'EUR',
      });
      expect(result).not.toHaveProperty('target_currency');
      expect(result).not.toHaveProperty('exchange_rate');
    });
  });

  describe('templateLineSchema coercion (PUL-57)', () => {
    it('should coerce string amount from Supabase numeric(12,2) to number', () => {
      const apiData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        templateId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Salaire',
        amount: '5000.00', // Supabase PostgREST returns numeric as string
        kind: 'income',
        recurrence: 'fixed',
        description: 'Salaire mensuel',
        createdAt: '2026-01-01T00:00:00+00:00',
        updatedAt: '2026-01-01T00:00:00+00:00',
      };

      const result = templateLineSchema.parse(apiData);

      expect(result.amount).toBe(5000);
      expect(typeof result.amount).toBe('number');
    });

    it('should coerce zero string amount (encrypted mode)', () => {
      const apiData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        templateId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Loyer',
        amount: '0.00',
        kind: 'expense',
        recurrence: 'fixed',
        description: 'Loyer',
        createdAt: '2026-01-01T00:00:00+00:00',
        updatedAt: '2026-01-01T00:00:00+00:00',
      };

      const result = templateLineSchema.parse(apiData);

      expect(result.amount).toBe(0);
      expect(typeof result.amount).toBe('number');
    });

    it('should pass through number amounts unchanged', () => {
      const apiData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        templateId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test',
        amount: 1500,
        kind: 'expense',
        recurrence: 'fixed',
        description: 'Test',
        createdAt: '2026-01-01T00:00:00+00:00',
        updatedAt: '2026-01-01T00:00:00+00:00',
      };

      const result = templateLineSchema.parse(apiData);

      expect(result.amount).toBe(1500);
      expect(typeof result.amount).toBe('number');
    });
  });
});
