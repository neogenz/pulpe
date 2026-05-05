import { describe, expect, it } from 'vitest';
import {
  resetPasswordFormSchema,
  type ResetPasswordFormValue,
} from './reset-password-form.schema';

const validFormValue: ResetPasswordFormValue = {
  newPassword: 'superSecret1',
  confirmPassword: 'superSecret1',
};

describe('resetPasswordFormSchema', () => {
  describe('transform', () => {
    it('should omit confirmPassword from the output DTO', () => {
      const result = resetPasswordFormSchema.parse(validFormValue);

      expect(result).toEqual({ newPassword: 'superSecret1' });
      expect('confirmPassword' in result).toBe(false);
    });
  });

  describe('validation', () => {
    it('should reject when passwords do not match', () => {
      const result = resetPasswordFormSchema.safeParse({
        ...validFormValue,
        confirmPassword: 'different1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
      }
    });

    it('should reject password shorter than minimum length', () => {
      const result = resetPasswordFormSchema.safeParse({
        newPassword: 'short',
        confirmPassword: 'short',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing newPassword field', () => {
      const result = resetPasswordFormSchema.safeParse({
        confirmPassword: 'superSecret1',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing confirmPassword field', () => {
      const result = resetPasswordFormSchema.safeParse({
        newPassword: 'superSecret1',
      });

      expect(result.success).toBe(false);
    });
  });
});
