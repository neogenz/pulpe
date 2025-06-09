import { Injectable } from '@angular/core';
import { BudgetCategory } from '../../core/budget/budget.models';
import { Budget, Transaction } from '@pulpe/shared';

type CategoryType = BudgetCategory['type'];

@Injectable()
export class BudgetCalculator {
  calculateTotalIncome(budget: Budget, transactions: Transaction[]): number {
    return this.#calculateTotalForType(budget, transactions, 'income');
  }

  calculateTotalExpenses(budget: Budget, transactions: Transaction[]): number {
    return this.#calculateTotalForType(budget, transactions, 'expense');
  }

  calculateTotalSavings(budget: Budget, transactions: Transaction[]): number {
    return this.#calculateTotalForType(budget, transactions, 'savings');
  }

  calculateNegativeBudget(budget: Budget, transactions: Transaction[]): number {
    return Math.min(
      0,
      this.calculateTotalIncome(budget, transactions) -
        this.calculateTotalExpenses(budget, transactions),
    );
  }

  #calculateTotalForType(
    budget: Budget,
    transactions: Transaction[],
    type: CategoryType,
  ): number {
    return transactions
      .filter((category) => category.type === type)
      .reduce((total, category) => total + category.amount, 0);
  }
}
