import { Injectable } from '@angular/core';
import { MonthlyBudget } from '../../core/budget/budget.models';

@Injectable({
  providedIn: 'root',
})
export class BudgetCalculator {
  /**
   * Calcul le total des revenus du budget
   * @param budget - Le budget à calculer
   * @returns Le total des revenus
   */
  calculateTotalIncome(budget: MonthlyBudget): number {
    let total = 0;
    for (const category of budget.categories) {
      if (category.type === 'income') {
        total += category.actualAmount;
      }
    }
    return total;
  }

  /**
   * Calcul le total des dépenses du budget
   * @param budget - Le budget à calculer
   * @returns Le total des dépenses
   */
  calculateTotalExpenses(budget: MonthlyBudget): number {
    let total = 0;
    for (const category of budget.categories) {
      if (category.type === 'expense') {
        total += category.actualAmount;
      }
    }
    return total;
  }

  /**
   * Calcul le total des économies du budget
   * @param budget - Le budget à calculer
   * @returns Le total des économies
   */
  calculateTotalSavings(budget: MonthlyBudget): number {
    let total = 0;
    for (const category of budget.categories) {
      if (category.type === 'savings') {
        total += category.actualAmount;
      }
    }
    return total;
  }

  /**
   * Calcul le budget négatif du budget
   * @param budget - Le budget à calculer
   * @returns Le budget négatif
   */
  calculateNegativeBudget(budget: MonthlyBudget): number {
    return Math.min(
      0,
      this.calculateTotalIncome(budget) - this.calculateTotalExpenses(budget),
    );
  }
}
