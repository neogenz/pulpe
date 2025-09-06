import { Injectable } from '@angular/core';
import { type TemplateLine } from '@pulpe/shared';

export interface TemplateTotals {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  remainingLivingAllowance: number;
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
    const totalIncome = this.#calculateIncome(lines);
    const totalExpenses = this.#calculateExpenses(lines);
    const totalSavings = this.#calculateSavings(lines);
    const remainingLivingAllowance = this.#calculateRemainingAllowance(
      totalIncome,
      totalExpenses,
      totalSavings,
    );

    return {
      totalIncome,
      totalExpenses,
      totalSavings,
      remainingLivingAllowance,
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
      totalIncome: 0,
      totalExpenses: 0,
      totalSavings: 0,
      remainingLivingAllowance: 0,
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
   * Calculate remaining living allowance
   * Formula: Income - (Expenses + Savings)
   * This represents the amount available for variable spending
   */
  #calculateRemainingAllowance(
    income: number,
    expenses: number,
    savings: number,
  ): number {
    return income - (expenses + savings);
  }
}
