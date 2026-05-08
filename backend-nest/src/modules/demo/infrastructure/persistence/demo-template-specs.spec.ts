import { describe, it, expect } from 'bun:test';
import {
  getHolidayMonthLines,
  getSavingsMonthLines,
  getStandardMonthLines,
  getVacationMonthLines,
} from './demo-template-specs';

describe('demo-template-specs pure data functions', () => {
  describe('getStandardMonthLines', () => {
    it('should return seeds with plain numeric amounts and the given templateId', () => {
      const lines = getStandardMonthLines('tpl-1');

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.templateId).toBe('tpl-1');
        expect(typeof line.amount).toBe('number');
        expect(line.amount).toBeGreaterThan(0);
        expect(['income', 'expense', 'saving']).toContain(line.kind);
        expect(['fixed', 'one_off']).toContain(line.recurrence);
      }
    });

    it('should include income, expense, and saving kinds', () => {
      const lines = getStandardMonthLines('tpl-1');
      const kinds = new Set(lines.map((l) => l.kind));

      expect(kinds.has('income')).toBe(true);
      expect(kinds.has('expense')).toBe(true);
      expect(kinds.has('saving')).toBe(true);
    });
  });

  describe('getVacationMonthLines', () => {
    it('should return seeds all belonging to the given template', () => {
      const lines = getVacationMonthLines('tpl-2');

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.templateId).toBe('tpl-2');
      }
    });
  });

  describe('getSavingsMonthLines', () => {
    it('should include savings lines', () => {
      const lines = getSavingsMonthLines('tpl-3');
      const savingLines = lines.filter((l) => l.kind === 'saving');

      expect(savingLines.length).toBeGreaterThan(0);
    });
  });

  describe('getHolidayMonthLines', () => {
    it('should return seeds all belonging to the given template', () => {
      const lines = getHolidayMonthLines('tpl-4');

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.templateId).toBe('tpl-4');
      }
    });
  });
});
