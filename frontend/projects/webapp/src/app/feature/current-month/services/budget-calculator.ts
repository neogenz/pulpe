import { Injectable } from '@angular/core';
import { Transaction, TransactionKind } from '@pulpe/shared';

type CategoryType = TransactionKind;

@Injectable()
export class BudgetCalculator {
  calculateTotalIncome(transactions: Transaction[]): number {
    return this.#calculateTotalForType(transactions, 'income');
  }

  calculateTotalExpenses(transactions: Transaction[]): number {
    return this.#calculateTotalForType(transactions, 'expense');
  }

  calculateTotalSavings(transactions: Transaction[]): number {
    return this.#calculateTotalForType(transactions, 'saving');
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
