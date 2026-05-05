import { describe, expect, it } from 'vitest';
import {
  setupVaultCodeFormSchema,
  type SetupVaultCodeFormValue,
} from './setup-vault-code-form.schema';

const validFormValue: SetupVaultCodeFormValue = {
  vaultCode: '1234',
  confirmCode: '1234',
  rememberDevice: false,
};

describe('setupVaultCodeFormSchema', () => {
  describe('transform', () => {
    it('should omit confirmCode from the output DTO', () => {
      const result = setupVaultCodeFormSchema.parse(validFormValue);

      expect(result).toEqual({
        vaultCode: '1234',
        rememberDevice: false,
      });
      expect('confirmCode' in result).toBe(false);
    });

    it('should forward rememberDevice when true', () => {
      const result = setupVaultCodeFormSchema.parse({
        ...validFormValue,
        rememberDevice: true,
      });

      expect(result.rememberDevice).toBe(true);
    });
  });

  describe('validation', () => {
    it('should reject when vaultCode and confirmCode do not match', () => {
      const result = setupVaultCodeFormSchema.safeParse({
        ...validFormValue,
        confirmCode: '9999',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['confirmCode']);
      }
    });

    it('should reject non-numeric vault codes', () => {
      const result = setupVaultCodeFormSchema.safeParse({
        ...validFormValue,
        vaultCode: 'abcd',
        confirmCode: 'abcd',
      });

      expect(result.success).toBe(false);
    });

    it('should reject vault codes of incorrect length', () => {
      const result = setupVaultCodeFormSchema.safeParse({
        ...validFormValue,
        vaultCode: '12',
        confirmCode: '12',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing rememberDevice flag', () => {
      const result = setupVaultCodeFormSchema.safeParse({
        vaultCode: validFormValue.vaultCode,
        confirmCode: validFormValue.confirmCode,
      });

      expect(result.success).toBe(false);
    });
  });
});
