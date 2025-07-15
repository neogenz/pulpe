import { Injectable } from '@angular/core';
import { Transaction, TransactionKind } from '@pulpe/shared';

@Injectable()
export class BudgetCalculator {
  calculateTotalIncome(transactions: Transaction[]): number {
    return this.#calculateTotalForType(transactions, 'INCOME');
  }

  calculateTotalExpenses(transactions: Transaction[]): number {
    return this.#calculateTotalForType(transactions, 'FIXED_EXPENSE');
  }

  calculateTotalSavings(transactions: Transaction[]): number {
    return this.#calculateTotalForType(transactions, 'SAVINGS_CONTRIBUTION');
  }

  calculateNegativeBudget(transactions: Transaction[]): number {
    return Math.min(
      0,
      this.calculateTotalIncome(transactions) -
        this.calculateTotalExpenses(transactions) -
        this.calculateTotalSavings(transactions),
    );
  }

  #calculateTotalForType(
    transactions: Transaction[],
    kind: TransactionKind,
  ): number {
    return transactions
      .filter((transaction) => transaction.kind === kind)
      .reduce((total, transaction) => total + transaction.amount, 0);
  }
}
