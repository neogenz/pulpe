import { describe, expect, it } from 'vitest';
import {
  changePasswordFormSchema,
  type ChangePasswordFormValue,
} from './change-password-dialog.schema';

const validFormValue: ChangePasswordFormValue = {
  currentPassword: 'oldPass12',
  newPassword: 'newPass345',
  confirmPassword: 'newPass345',
};

describe('changePasswordFormSchema', () => {
  describe('transform', () => {
    it('should omit confirmPassword from the output DTO', () => {
      const result = changePasswordFormSchema.parse(validFormValue);

      expect(result).toEqual({
        currentPassword: 'oldPass12',
        newPassword: 'newPass345',
      });
      expect('confirmPassword' in result).toBe(false);
    });
  });

  describe('validation', () => {
    it('should reject when new and confirm passwords do not match', () => {
      const result = changePasswordFormSchema.safeParse({
        ...validFormValue,
        confirmPassword: 'different',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
      }
    });

    it('should reject new password shorter than minimum length', () => {
      const result = changePasswordFormSchema.safeParse({
        currentPassword: 'oldPass12',
        newPassword: 'short',
        confirmPassword: 'short',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty currentPassword', () => {
      const result = changePasswordFormSchema.safeParse({
        ...validFormValue,
        currentPassword: '',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing currentPassword field', () => {
      const result = changePasswordFormSchema.safeParse({
        newPassword: 'newPass345',
        confirmPassword: 'newPass345',
      });

      expect(result.success).toBe(false);
    });
  });
});
