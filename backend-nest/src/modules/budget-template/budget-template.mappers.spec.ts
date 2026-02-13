import { describe, it, expect } from 'bun:test';
import { templateLineSchema } from 'pulpe-shared';
import {
  toApiTemplateLine,
  toApiTemplateLineList,
} from './budget-template.mappers';
import type { Tables } from '@/types/database.types';

describe('BudgetTemplate Mappers', () => {
  describe('toApiTemplateLine', () => {
    it('should map all fields from DB row to API entity', () => {
      const dbRow: Tables<'template_line'> = {
        id: 'line-123',
        template_id: 'template-123',
        name: 'Salaire',
        amount: 5000,
        amount_encrypted: null,
        kind: 'income',
        recurrence: 'fixed',
        description: 'Salaire mensuel',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
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
      const dbRows: Tables<'template_line'>[] = [
        {
          id: 'line-1',
          template_id: 'template-123',
          name: 'Salaire',
          amount: 5000,
          amount_encrypted: null,
          kind: 'income',
          recurrence: 'fixed',
          description: '',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'line-2',
          template_id: 'template-123',
          name: 'Loyer',
          amount: 1200.5,
          amount_encrypted: null,
          kind: 'expense',
          recurrence: 'fixed',
          description: '',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      const results = toApiTemplateLineList(dbRows);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Salaire');
      expect(results[1].name).toBe('Loyer');
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
