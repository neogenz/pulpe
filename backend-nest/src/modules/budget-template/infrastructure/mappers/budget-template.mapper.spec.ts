import { describe, it, expect } from 'bun:test';
import { BudgetTemplateMapper } from './budget-template.mapper';
import type { Tables } from '../../../../types/database.types';

const makeEncryptionService = (decryptFn: (ct: string) => number) => ({
  tryDecryptAmount: (ciphertext: string, _dek: Buffer, fallback: unknown) => {
    try {
      return decryptFn(ciphertext);
    } catch {
      return fallback as number;
    }
  },
});

const mockDek = Buffer.from('dek');

const baseTemplateLine: Tables<'template_line'> = {
  id: 'line-1',
  template_id: 'template-1',
  name: 'Salaire',
  amount: 'encrypted-5000',
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

describe('BudgetTemplateMapper', () => {
  const mapper = new BudgetTemplateMapper();

  describe('decryptLine', () => {
    it('should decrypt amount and return numeric value', () => {
      const encryptionService = makeEncryptionService(() => 5000);

      const result = mapper.decryptLine(
        baseTemplateLine,
        encryptionService as never,
        mockDek,
      );

      expect(result.amount).toBe(5000);
      expect(result.original_amount).toBeNull();
    });

    it('should use 0 as fallback when amount is null', () => {
      const line: Tables<'template_line'> = {
        ...baseTemplateLine,
        amount: null,
      };
      const encryptionService = makeEncryptionService(() => 5000);

      const result = mapper.decryptLine(
        line,
        encryptionService as never,
        mockDek,
      );

      expect(result.amount).toBe(0);
    });

    it('should decrypt original_amount when present', () => {
      const line: Tables<'template_line'> = {
        ...baseTemplateLine,
        original_amount: 'encrypted-4700',
      };
      const encryptionService = makeEncryptionService((ct) =>
        ct === 'encrypted-5000' ? 5000 : 4700,
      );

      const result = mapper.decryptLine(
        line,
        encryptionService as never,
        mockDek,
      );

      expect(result.amount).toBe(5000);
      expect(result.original_amount).toBe(4700);
    });

    it('should return null for original_amount when not set', () => {
      const encryptionService = makeEncryptionService(() => 5000);

      const result = mapper.decryptLine(
        baseTemplateLine,
        encryptionService as never,
        mockDek,
      );

      expect(result.original_amount).toBeNull();
    });

    it('should preserve all non-encrypted fields', () => {
      const encryptionService = makeEncryptionService(() => 5000);

      const result = mapper.decryptLine(
        baseTemplateLine,
        encryptionService as never,
        mockDek,
      );

      expect(result.id).toBe('line-1');
      expect(result.template_id).toBe('template-1');
      expect(result.name).toBe('Salaire');
      expect(result.kind).toBe('income');
      expect(result.recurrence).toBe('fixed');
    });
  });

  describe('toApiTemplateLine', () => {
    it('should map all fields to camelCase API shape', () => {
      const decrypted = {
        ...baseTemplateLine,
        amount: 5000,
        original_amount: null as null,
      };

      const result = mapper.toApiTemplateLine(decrypted);

      expect(result.id).toBe('line-1');
      expect(result.templateId).toBe('template-1');
      expect(result.name).toBe('Salaire');
      expect(result.amount).toBe(5000);
      expect(result.kind).toBe('income');
      expect(result.recurrence).toBe('fixed');
    });
  });

  describe('toDbTemplateUpdate', () => {
    it('should only include defined fields', () => {
      const result = mapper.toDbTemplateUpdate({ name: 'New Name' });

      expect(result).toEqual({ name: 'New Name' });
      expect(result).not.toHaveProperty('is_default');
      expect(result).not.toHaveProperty('description');
    });

    it('should map isDefault to is_default', () => {
      const result = mapper.toDbTemplateUpdate({ isDefault: true });

      expect(result).toEqual({ is_default: true });
    });
  });
});
