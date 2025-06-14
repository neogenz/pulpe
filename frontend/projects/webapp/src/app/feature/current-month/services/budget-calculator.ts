import { Injectable } from '@angular/core';
import { Transaction } from '@pulpe/shared';
import { BudgetCategory } from '../../../core/budget/budget.models';

type CategoryType = BudgetCategory['type'];

@Injectable()
export class BudgetCalculator {
  calculateTotalIncome(transactions: Transaction[]): number {
    return this.#calculateTotalForType(transactions, 'income');
  }

  calculateTotalExpenses(transactions: Transaction[]): number {
    return this.#calculateTotalForType(transactions, 'expense');
  }

  calculateTotalSavings(transactions: Transaction[]): number {
    return this.#calculateTotalForType(transactions, 'savings');
  }

  calculateNegativeBudget(transactions: Transaction[]): number {
    return Math.min(
      0,
      this.calculateTotalIncome(transactions) -
        this.calculateTotalExpenses(transactions),
    );
  }

  #calculateTotalForType(
    transactions: Transaction[],
    type: CategoryType,
  ): number {
    return transactions
      .filter((category) => category.type === type)
      .reduce((total, category) => total + category.amount, 0);
  }
}
