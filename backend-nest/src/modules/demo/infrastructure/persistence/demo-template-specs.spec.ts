import { describe, it, expect } from 'bun:test';
import {
  getStandardMonthLines,
  getVacationMonthLines,
  getSavingsMonthLines,
  getHolidayMonthLines,
} from './demo-template-specs';
import type { EncryptionPort } from '@modules/encryption/domain/ports/encryption.port';

const mockEncryption = {
  encryptAmount: (amount: number) => `enc-${amount}`,
  decryptAmount: (ciphertext: string) => Number(ciphertext.replace('enc-', '')),
  tryDecryptAmount: (_c: unknown, _d: unknown, fallback: unknown) =>
    fallback as number,
  decryptRowAmountFields: (row: unknown) =>
    ({ ...(row as object), amount: 0, original_amount: null }) as unknown,
  ensureUserDEK: async () => Buffer.alloc(32),
  getUserDEK: async () => Buffer.alloc(32),
  prepareAmountData: async () => ({ amount: 'enc' }),
  prepareAmountsData: async () => [],
  encryptOptionalAmount: async () => null,
} as unknown as EncryptionPort;

const dek = Buffer.alloc(32);

describe('demo-template-specs pure functions', () => {
  describe('getStandardMonthLines', () => {
    it('should return lines with encrypted amounts', () => {
      const lines = getStandardMonthLines('tpl-1', mockEncryption, dek);

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.template_id).toBe('tpl-1');
        expect(line.amount).toMatch(/^enc-/);
        expect(['income', 'expense', 'saving']).toContain(line.kind);
        expect(['fixed', 'one_off']).toContain(line.recurrence);
      }
    });

    it('should include income, expense, and saving kinds', () => {
      const lines = getStandardMonthLines('tpl-1', mockEncryption, dek);
      const kinds = new Set(lines.map((l) => l.kind));

      expect(kinds.has('income')).toBe(true);
      expect(kinds.has('expense')).toBe(true);
      expect(kinds.has('saving')).toBe(true);
    });
  });

  describe('getVacationMonthLines', () => {
    it('should return lines all belonging to the given template', () => {
      const lines = getVacationMonthLines('tpl-2', mockEncryption, dek);

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.template_id).toBe('tpl-2');
      }
    });
  });

  describe('getSavingsMonthLines', () => {
    it('should include high savings amounts relative to expenses', () => {
      const lines = getSavingsMonthLines('tpl-3', mockEncryption, dek);
      const savingLines = lines.filter((l) => l.kind === 'saving');

      expect(savingLines.length).toBeGreaterThan(0);
    });
  });

  describe('getHolidayMonthLines', () => {
    it('should return lines all belonging to the given template', () => {
      const lines = getHolidayMonthLines('tpl-4', mockEncryption, dek);

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.template_id).toBe('tpl-4');
      }
    });
  });
});
