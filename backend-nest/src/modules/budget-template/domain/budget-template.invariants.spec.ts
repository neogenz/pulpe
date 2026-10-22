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
        BudgetTemplateInvariants.validateTemplateNotUsed('template-1', [
          { month: 10, year: 2026 },
        ]),
      ).toThrow(BusinessException);
    });

    it('should name every month built from the template in the message', () => {
      expect(() =>
        BudgetTemplateInvariants.validateTemplateNotUsed('template-1', [
          { month: 10, year: 2026 },
          { month: 11, year: 2026 },
        ]),
      ).toThrow('Used by: 10/2026, 11/2026');
    });

    it('should not throw when template is not used in any budget', () => {
      expect(() =>
        BudgetTemplateInvariants.validateTemplateNotUsed('template-1', []),
      ).not.toThrow();
    });
  });
});
