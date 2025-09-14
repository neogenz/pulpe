import { Injectable } from '@angular/core';
import { type TemplateLine } from '@pulpe/shared';

export interface TemplateTotals {
  income: number;
  expenses: number; // Expenses only (not including savings)
  savings: number; // Kept separate for detailed display
  netBalance: number; // income - (expenses + savings) as per SPECS
  loading: boolean;
}

/**
 * Pure calculation service for template financial totals.
 * All methods are pure functions without side effects.
 *
 * Following Angular 20 naming convention (no .service suffix)
 */
@Injectable()
export class TemplateTotalsCalculator {
  /**
   * Calculate totals for a single template from its lines
   */
  calculateTemplateTotals(lines: TemplateLine[]): TemplateTotals {
    const income = this.#calculateIncome(lines);
    const expenses = this.#calculateExpenses(lines);
    const savings = this.#calculateSavings(lines);
    const netBalance = this.#calculateNetBalance(income, expenses, savings);

    return {
      income,
      expenses,
      savings,
      netBalance,
      loading: false,
    };
  }

  /**
   * Calculate totals for multiple templates in batch
   * Optimized for performance when processing multiple templates
   */
  calculateBatchTotals(
    templatesWithLines: { id: string; lines: TemplateLine[] }[],
  ): Record<string, TemplateTotals> {
    return templatesWithLines.reduce(
      (acc, { id, lines }) => {
        acc[id] = this.calculateTemplateTotals(lines);
        return acc;
      },
      {} as Record<string, TemplateTotals>,
    );
  }

  /**
   * Create default totals with specified loading state
   */
  createDefaultTotals(loading: boolean): TemplateTotals {
    return {
      income: 0,
      expenses: 0,
      savings: 0,
      netBalance: 0,
      loading,
    };
  }

  /**
   * Calculate total income from template lines
   */
  #calculateIncome(lines: TemplateLine[]): number {
    return lines
      .filter((line) => line.kind === 'income')
      .reduce((sum, line) => sum + line.amount, 0);
  }

  /**
   * Calculate total expenses from template lines
   * Note: Expenses are lines with kind 'expense' only
   */
  #calculateExpenses(lines: TemplateLine[]): number {
    return lines
      .filter((line) => line.kind === 'expense')
      .reduce((sum, line) => sum + line.amount, 0);
  }

  /**
   * Calculate total savings from template lines
   * Note: Savings are treated separately from expenses
   */
  #calculateSavings(lines: TemplateLine[]): number {
    return lines
      .filter((line) => line.kind === 'saving')
      .reduce((sum, line) => sum + line.amount, 0);
  }

  /**
   * Calculate net balance as per SPECS
   * Formula: Income - (Expenses + Savings)
   * This represents the net balance after all planned outflows
   */
  #calculateNetBalance(
    income: number,
    expenses: number,
    savings: number,
  ): number {
    return income - (expenses + savings);
  }
}
