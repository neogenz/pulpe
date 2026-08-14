import { describe, expect, it } from 'vitest';
import {
  PASSWORD_HAS_LETTER,
  PASSWORD_HAS_NUMBER,
  signupFormSchema,
  type SignupFormValue,
} from './signup-form.schema';
import * as passwordCriteriaSource from '@ui/password-criteria';

const validFormValue: SignupFormValue = {
  email: 'user@example.com',
  password: 'superSecret1',
};

describe('signupFormSchema', () => {
  it('validates with the exact regexes the visual checklist renders', () => {
    // Source unique : le schema ré-exporte les objets RegExp de
    // ui/password-criteria. Si quelqu'un redéclare une copie locale d'un côté,
    // l'identité casse ici — la soumission et la checklist divergeraient.
    expect(PASSWORD_HAS_NUMBER).toBe(
      passwordCriteriaSource.PASSWORD_HAS_NUMBER,
    );
    expect(PASSWORD_HAS_LETTER).toBe(
      passwordCriteriaSource.PASSWORD_HAS_LETTER,
    );
  });

  describe('output', () => {
    it('should return the account credentials', () => {
      const result = signupFormSchema.parse(validFormValue);

      expect(result).toEqual({
        email: 'user@example.com',
        password: 'superSecret1',
      });
    });
  });

  describe('validation', () => {
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
      });

      expect(result.success).toBe(false);
    });

    it('should reject a password without any digit (iOS parity)', () => {
      const result = signupFormSchema.safeParse({
        email: 'user@example.com',
        password: 'onlyLettersHere',
      });

      expect(result.success).toBe(false);
    });

    it('should reject a password without any letter (iOS parity)', () => {
      const result = signupFormSchema.safeParse({
        email: 'user@example.com',
        password: '1234567890',
      });

      expect(result.success).toBe(false);
    });

    it('should accept an accented-letter password (unicode letter class)', () => {
      const result = signupFormSchema.safeParse({
        email: 'user@example.com',
        password: 'événement42',
      });

      expect(result.success).toBe(true);
    });
  });
});
