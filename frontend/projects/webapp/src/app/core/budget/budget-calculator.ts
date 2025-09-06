import { Injectable } from '@angular/core';
import {
  type Transaction,
  type BudgetLine,
  type TransactionKind,
} from '@pulpe/shared';

@Injectable({ providedIn: 'root' })
export class BudgetCalculator {
  /**
   * Calcule le Fixed Block selon les spécifications métier
   * Fixed Block = somme de toutes les dépenses fixes + épargne planifiée (depuis les budget lines)
   */
  calculateFixedBlock(budgetLines: BudgetLine[]): number {
    return budgetLines
      .filter((line) => line.kind === 'expense' || line.kind === 'saving')
      .reduce((total, line) => total + line.amount, 0);
  }

  /**
   * Calcule le revenu planifié depuis les budget lines
   */
  calculatePlannedIncome(budgetLines: BudgetLine[]): number {
    return budgetLines
      .filter((line) => line.kind === 'income')
      .reduce((total, line) => total + line.amount, 0);
  }

  /**
   * Calcule la Living Allowance selon les spécifications métier
   * Living Allowance = Revenu planifié - Fixed Block
   */
  calculateLivingAllowance(budgetLines: BudgetLine[]): number {
    const plannedIncome = this.calculatePlannedIncome(budgetLines);
    const fixedBlock = this.calculateFixedBlock(budgetLines);
    return plannedIncome - fixedBlock;
  }

  /**
   * Calcule l'impact des transactions réelles sur la Living Allowance
   * Note: Selon RG-007, les transactions diminuent la Living Allowance
   * - Les revenus (income) l'augmentent (+)
   * - Les dépenses et épargnes (expense, saving) la diminuent (-)
   */
  calculateActualTransactionsAmount(transactions: Transaction[]): number {
    return transactions.reduce(
      (total, transaction) =>
        total + this.#getSignedAmount(transaction.kind, transaction.amount),
      0,
    );
  }

  /**
   * Calcule les balances cumulatives pour une liste d'items
   * Logique métier pure : traite chaque item et calcule le cumul
   */
  calculateRunningBalances<T extends { kind: TransactionKind; amount: number }>(
    items: T[],
  ): (T & { cumulativeBalance: number })[] {
    let runningBalance = 0;
    return items.map((item) => {
      const signedAmount = this.#getSignedAmount(item.kind, item.amount);
      runningBalance += signedAmount;
      return {
        ...item,
        cumulativeBalance: runningBalance,
      };
    });
  }

  /**
   * Détermine la valeur avec signe selon les règles métier
   */
  #getSignedAmount(kind: TransactionKind, amount: number): number {
    switch (kind) {
      case 'income':
        return amount; // Positif
      case 'expense':
      case 'saving':
        return -amount; // Négatif
      default:
        return 0;
    }
  }
}
