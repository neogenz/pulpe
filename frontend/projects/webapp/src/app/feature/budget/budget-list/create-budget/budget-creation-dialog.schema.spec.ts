import { describe, expect, it } from 'vitest';
import {
  budgetCreationFormSchema,
  type BudgetCreationFormValue,
} from './budget-creation-dialog.schema';

const TEMPLATE_ID = '00000000-0000-4000-8000-000000000001';

const validFormValue: BudgetCreationFormValue = {
  monthYear: new Date(2026, 5, 1), // June 2026 (getMonth returns 5)
  description: 'Vacances',
  templateId: TEMPLATE_ID,
};

describe('budgetCreationFormSchema', () => {
  describe('transform', () => {
    it('should split monthYear Date into 1-based month and year', () => {
      const result = budgetCreationFormSchema.parse(validFormValue);

      expect(result).toEqual({
        month: 6,
        year: 2026,
        description: 'Vacances',
        templateId: TEMPLATE_ID,
      });
      expect('monthYear' in result).toBe(false);
    });

    it('should produce month 1 for January', () => {
      const result = budgetCreationFormSchema.parse({
        ...validFormValue,
        monthYear: new Date(2026, 0, 1),
      });

      expect(result.month).toBe(1);
      expect(result.year).toBe(2026);
    });

    it('should produce month 12 for December', () => {
      const result = budgetCreationFormSchema.parse({
        ...validFormValue,
        monthYear: new Date(2026, 11, 1),
      });

      expect(result.month).toBe(12);
      expect(result.year).toBe(2026);
    });

    it('should trim whitespace from description', () => {
      const result = budgetCreationFormSchema.parse({
        ...validFormValue,
        description: '  Vacances  ',
      });

      expect(result.description).toBe('Vacances');
    });

    it('should preserve empty description as empty string in the DTO', () => {
      const result = budgetCreationFormSchema.parse({
        ...validFormValue,
        description: '',
      });

      expect(result).toEqual({
        month: 6,
        year: 2026,
        description: '',
        templateId: TEMPLATE_ID,
      });
    });
  });

  describe('validation', () => {
    it('should reject a non-UUID templateId', () => {
      const result = budgetCreationFormSchema.safeParse({
        ...validFormValue,
        templateId: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
    });

    it('should reject a non-Date monthYear', () => {
      const result = budgetCreationFormSchema.safeParse({
        ...validFormValue,
        monthYear: '2026-06-01',
      });

      expect(result.success).toBe(false);
    });

    it('should reject a description longer than the max length', () => {
      const result = budgetCreationFormSchema.safeParse({
        ...validFormValue,
        description: 'x'.repeat(101),
      });

      expect(result.success).toBe(false);
    });
  });
});
