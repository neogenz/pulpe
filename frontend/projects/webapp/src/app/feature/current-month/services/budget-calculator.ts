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

  /**
   * Calcule le pourcentage du budget utilisé
   * @param totalBudget Le budget total disponible
   * @param usedAmount Le montant déjà utilisé
   * @returns Le pourcentage utilisé (0-100), avec gestion des cas limites
   */
  calculateUsedPercentage(totalBudget: number, usedAmount: number): number {
    // Gestion des cas limites
    if (!totalBudget || totalBudget <= 0) {
      return 0;
    }

    if (!usedAmount || usedAmount < 0) {
      return 0;
    }

    // Calcul du pourcentage
    const percentage = (usedAmount / totalBudget) * 100;

    // S'assurer que le résultat est entre 0 et 100
    return Math.min(Math.max(0, percentage), 100);
  }

  /**
   * Calcule le montant restant dans le budget
   * @param totalBudget Le budget total disponible
   * @param usedAmount Le montant déjà utilisé
   * @returns Le montant restant
   */
  calculateRemainingAmount(totalBudget: number, usedAmount: number): number {
    if (!totalBudget || totalBudget < 0) {
      return 0;
    }

    if (!usedAmount || usedAmount < 0) {
      return totalBudget;
    }

    return Math.max(0, totalBudget - usedAmount);
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
