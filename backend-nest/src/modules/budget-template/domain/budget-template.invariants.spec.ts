import { describe, it, expect } from 'bun:test';
import { BudgetTemplateInvariants } from './budget-template.invariants';
import { BusinessException } from '@common/exceptions/business.exception';

describe('BudgetTemplateInvariants', () => {
  describe('validateTemplateLimit', () => {
    it('should throw when count equals the limit (5)', () => {
      expect(() => BudgetTemplateInvariants.validateTemplateLimit(5)).toThrow(
        BusinessException,
      );
    });

    it('should throw when count exceeds the limit', () => {
      expect(() => BudgetTemplateInvariants.validateTemplateLimit(6)).toThrow(
        BusinessException,
      );
    });

    it('should not throw when count is below the limit', () => {
      expect(() =>
        BudgetTemplateInvariants.validateTemplateLimit(4),
      ).not.toThrow();
    });

    it('should not throw when count is zero', () => {
      expect(() =>
        BudgetTemplateInvariants.validateTemplateLimit(0),
      ).not.toThrow();
    });
  });

  describe('validateTemplateNotUsed', () => {
    it('should throw when template is used in at least one budget', () => {
      expect(() =>
        BudgetTemplateInvariants.validateTemplateNotUsed('template-1', 1),
      ).toThrow(BusinessException);
    });

    it('should throw when template is used in multiple budgets', () => {
      expect(() =>
        BudgetTemplateInvariants.validateTemplateNotUsed('template-1', 3),
      ).toThrow(BusinessException);
    });

    it('should not throw when template is not used in any budget', () => {
      expect(() =>
        BudgetTemplateInvariants.validateTemplateNotUsed('template-1', 0),
      ).not.toThrow();
    });
  });
});
