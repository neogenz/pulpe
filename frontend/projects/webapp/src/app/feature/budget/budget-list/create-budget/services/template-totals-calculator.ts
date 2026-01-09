import { Injectable } from '@angular/core';
import { type TemplateLine, BudgetFormulas } from 'pulpe-shared';

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
   * Delegates to BudgetFormulas for consistency (DRY principle)
   */
  calculateTemplateTotals(lines: TemplateLine[]): TemplateTotals {
    // Use BudgetFormulas for income calculation (single source of truth)
    const income = BudgetFormulas.calculateTotalIncome(lines, []);

    // Use BudgetFormulas for total expenses (includes savings per SPECS)
    const totalExpensesWithSavings = BudgetFormulas.calculateTotalExpenses(
      lines,
      [],
    );

    // Separate expenses and savings for UI display purposes
    const expenses = lines
      .filter((line) => line.kind === 'expense')
      .reduce((sum, line) => sum + line.amount, 0);

    const savings = lines
      .filter((line) => line.kind === 'saving')
      .reduce((sum, line) => sum + line.amount, 0);

    // Net balance follows SPECS: income - (expenses + savings)
    const netBalance = income - totalExpensesWithSavings;

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

  // Private methods removed - now delegating to BudgetFormulas (DRY principle)
  // The separation of expenses and savings is kept inline for UI-specific needs
}
