import { describe, it, expect } from 'bun:test';
import {
  DEMO_SAVINGS_GOAL_SPECS,
  DEMO_TEMPLATE_ORDER,
  type DemoTemplateKey,
} from '../../domain/demo.constants';
import { MONTH_TRANSACTION_SPECS } from '../../domain/demo-transaction-seeds';
import {
  getHolidayMonthLines,
  getSavingsMonthLines,
  getStandardMonthLines,
  getVacationMonthLines,
} from './demo-template-specs';

const LINES_BY_TEMPLATE_KEY: Record<
  DemoTemplateKey,
  (templateId: string) => { name: string; kind: string }[]
> = {
  STANDARD: getStandardMonthLines,
  VACATIONS: getVacationMonthLines,
  SAVINGS: getSavingsMonthLines,
  HOLIDAYS: getHolidayMonthLines,
};

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

  /**
   * The actuals name their envelope by string, across the domain/infrastructure
   * boundary the seed cannot cross by import. Without this pairing, a themed
   * month kept naming standard envelopes and showed nothing consumed at all.
   */
  describe('envelopes the month actuals consume', () => {
    for (const key of DEMO_TEMPLATE_ORDER) {
      it(`should carry every envelope the ${key} actuals name`, () => {
        const names = new Set(
          LINES_BY_TEMPLATE_KEY[key]('tpl-1').map((line) => line.name),
        );
        const specs = MONTH_TRANSACTION_SPECS[key];

        expect(specs.length).toBeGreaterThan(0);
        for (const spec of specs) {
          expect(names.has(spec.envelopeName)).toBe(true);
        }
      });
    }
  });

  /**
   * Same string-across-the-boundary problem for the goals: a goal names its
   * prévision Épargne by name, and a rename on either side would silently leave
   * the goal fed by nothing.
   */
  it('should carry a saving line for every envelope a goal is fed by', () => {
    const savingNames = new Set(
      DEMO_TEMPLATE_ORDER.flatMap((key) =>
        LINES_BY_TEMPLATE_KEY[key]('tpl-1')
          .filter((line) => line.kind === 'saving')
          .map((line) => line.name),
      ),
    );

    expect(
      DEMO_SAVINGS_GOAL_SPECS.filter((spec) => spec.envelopeName !== null)
        .length,
    ).toBeGreaterThan(0);
    for (const goal of DEMO_SAVINGS_GOAL_SPECS) {
      if (goal.envelopeName === null) continue;
      expect(savingNames.has(goal.envelopeName)).toBe(true);
    }
  });
});
