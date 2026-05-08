import { describe, it, expect } from 'bun:test';
import { BudgetTemplateMapper } from './budget-template.mapper';
import type {
  BudgetTemplate,
  TemplateLine,
} from '../../domain/budget-template.entity';

const baseTemplate: BudgetTemplate = {
  id: 'template-1',
  userId: 'user-1',
  name: 'Standard',
  description: 'Default template',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const baseLine: TemplateLine = {
  id: 'line-1',
  templateId: 'template-1',
  name: 'Salaire',
  amount: 5000,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'income',
  recurrence: 'fixed',
  description: 'Salaire mensuel',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('BudgetTemplateMapper', () => {
  const mapper = new BudgetTemplateMapper();

  describe('toApiTemplate', () => {
    it('should map domain template to API DTO', () => {
      const result = mapper.toApiTemplate(baseTemplate);

      expect(result.id).toBe('template-1');
      expect(result.name).toBe('Standard');
      expect(result.userId).toBe('user-1');
      expect(result.isDefault).toBe(true);
      expect(result.description).toBe('Default template');
    });

    it('should convert null description to undefined', () => {
      const result = mapper.toApiTemplate({
        ...baseTemplate,
        description: null,
      });

      expect(result.description).toBeUndefined();
    });

    it('should convert null userId to undefined', () => {
      const result = mapper.toApiTemplate({ ...baseTemplate, userId: null });

      expect(result.userId).toBeUndefined();
    });
  });

  describe('toApiTemplateLine', () => {
    it('should map all fields to camelCase API shape', () => {
      const result = mapper.toApiTemplateLine(baseLine);

      expect(result.id).toBe('line-1');
      expect(result.templateId).toBe('template-1');
      expect(result.name).toBe('Salaire');
      expect(result.amount).toBe(5000);
      expect(result.kind).toBe('income');
      expect(result.recurrence).toBe('fixed');
    });

    it('should default null description to empty string', () => {
      const result = mapper.toApiTemplateLine({
        ...baseLine,
        description: null,
      });

      expect(result.description).toBe('');
    });

    it('should map currency metadata when present', () => {
      const result = mapper.toApiTemplateLine({
        ...baseLine,
        originalAmount: 4700,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.94,
      });

      expect(result.originalAmount).toBe(4700);
      expect(result.originalCurrency).toBe('EUR');
      expect(result.targetCurrency).toBe('CHF');
      expect(result.exchangeRate).toBe(0.94);
    });
  });
});
