import { describe, expect, it } from 'vitest';
import { signupFormSchema, type SignupFormValue } from './signup-form.schema';

const validFormValue: SignupFormValue = {
  email: 'user@example.com',
  password: 'superSecret1',
  confirmPassword: 'superSecret1',
  acceptTerms: true,
};

describe('signupFormSchema', () => {
  describe('transform', () => {
    it('should omit confirmPassword and acceptTerms from the output DTO', () => {
      const result = signupFormSchema.parse(validFormValue);

      expect(result).toEqual({
        email: 'user@example.com',
        password: 'superSecret1',
      });
      expect('confirmPassword' in result).toBe(false);
      expect('acceptTerms' in result).toBe(false);
    });
  });

  describe('validation', () => {
    it('should reject when password and confirmPassword do not match', () => {
      const result = signupFormSchema.safeParse({
        ...validFormValue,
        confirmPassword: 'different1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
      }
    });

    it('should reject an invalid email', () => {
      const result = signupFormSchema.safeParse({
        ...validFormValue,
        email: 'not-an-email',
      });

      expect(result.success).toBe(false);
    });

    it('should reject an email that Angular accepts but Zod rejects (single-char TLD)', () => {
      const result = signupFormSchema.safeParse({
        ...validFormValue,
        email: 'foo@bar.c',
      });

      expect(result.success).toBe(false);
    });

    it('should reject a password shorter than the minimum length', () => {
      const result = signupFormSchema.safeParse({
        email: 'user@example.com',
        password: 'short',
        confirmPassword: 'short',
        acceptTerms: true,
      });

      expect(result.success).toBe(false);
    });

    it('should reject acceptTerms=false', () => {
      const result = signupFormSchema.safeParse({
        ...validFormValue,
        acceptTerms: false,
      });

      expect(result.success).toBe(false);
    });
  });
});
