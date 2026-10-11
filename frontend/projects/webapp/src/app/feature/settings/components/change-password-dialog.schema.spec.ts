import { describe, expect, it } from 'vitest';
import {
  changePasswordFormSchema,
  type ChangePasswordFormValue,
} from './change-password-dialog.schema';

const validFormValue: ChangePasswordFormValue = {
  currentPassword: 'oldPass12',
  newPassword: 'newPass345',
};

describe('changePasswordFormSchema', () => {
  describe('payload', () => {
    it('should accept one new password without a confirmation field', () => {
      const result = changePasswordFormSchema.parse(validFormValue);

      expect(result).toEqual({
        currentPassword: 'oldPass12',
        newPassword: 'newPass345',
      });
      expect('confirmPassword' in result).toBe(false);
    });
  });

  describe('validation', () => {
    it('should reject new password shorter than minimum length', () => {
      const result = changePasswordFormSchema.safeParse({
        currentPassword: 'oldPass12',
        newPassword: 'short',
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
      });

      expect(result.success).toBe(false);
    });
  });
});
