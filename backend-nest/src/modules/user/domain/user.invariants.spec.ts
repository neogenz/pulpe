import { describe, it, expect } from 'bun:test';
import { UserInvariants } from './user.invariants';
import { BusinessException } from '@common/exceptions/business.exception';

describe('UserInvariants', () => {
  describe('validateProfileUpdate', () => {
    it('passes for trimmed first/last name within length', () => {
      expect(() =>
        UserInvariants.validateProfileUpdate({
          firstName: 'Jane',
          lastName: 'Doe',
        }),
      ).not.toThrow();
    });

    it('throws when firstName is empty', () => {
      expect(() =>
        UserInvariants.validateProfileUpdate({
          firstName: '',
          lastName: 'Doe',
        }),
      ).toThrow(BusinessException);
    });

    it('throws when firstName is whitespace only', () => {
      expect(() =>
        UserInvariants.validateProfileUpdate({
          firstName: '   ',
          lastName: 'Doe',
        }),
      ).toThrow(BusinessException);
    });

    it('throws when lastName is empty', () => {
      expect(() =>
        UserInvariants.validateProfileUpdate({
          firstName: 'Jane',
          lastName: '',
        }),
      ).toThrow(BusinessException);
    });

    it('throws when firstName exceeds 50 characters', () => {
      expect(() =>
        UserInvariants.validateProfileUpdate({
          firstName: 'a'.repeat(51),
          lastName: 'Doe',
        }),
      ).toThrow(BusinessException);
    });

    it('throws when lastName exceeds 50 characters', () => {
      expect(() =>
        UserInvariants.validateProfileUpdate({
          firstName: 'Jane',
          lastName: 'b'.repeat(51),
        }),
      ).toThrow(BusinessException);
    });

    it('passes at exactly 50 characters', () => {
      expect(() =>
        UserInvariants.validateProfileUpdate({
          firstName: 'a'.repeat(50),
          lastName: 'b'.repeat(50),
        }),
      ).not.toThrow();
    });
  });
});
