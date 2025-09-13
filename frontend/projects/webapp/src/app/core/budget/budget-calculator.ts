import { Injectable } from '@angular/core';
import {
  type Transaction,
  type BudgetLine,
  type TransactionKind,
  BudgetFormulas,
} from '@pulpe/shared';

@Injectable({ providedIn: 'root' })
export class BudgetCalculator {
  /**
   * Calcule le revenu planifié depuis les budget lines
   * Délègue au shared BudgetFormulas
   */
  calculatePlannedIncome(budgetLines: BudgetLine[]): number {
    return BudgetFormulas.calculateTotalIncome(budgetLines, []);
  }

  /**
   * Calcule l'impact des transactions réelles sur la balance
   * Note: Selon RG-007, les transactions diminuent la balance
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

  calculateTotalAvailable(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
    rollover = 0,
  ): number {
    const totalIncome = BudgetFormulas.calculateTotalIncome(
      budgetLines,
      transactions,
    );
    return BudgetFormulas.calculateAvailable(totalIncome, rollover);
  }

  /**
   * Enrichit les items avec leur balance cumulative de manière immutable
   * Logique métier pure : traite chaque item et calcule le cumul
   */
  enrichWithCumulativeBalance<
    T extends { kind: TransactionKind; amount: number },
  >(items: T[]): (T & { cumulativeBalance: number })[] {
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
   * Calcule le ending balance localement selon les spécifications métier
   * ending_balance = available - totalExpenses
   * Délègue au shared BudgetFormulas
   *
   * @param budgetLines Les lignes budgétaires planifiées
   * @param transactions Les transactions réelles effectuées
   * @param rollover Le rollover du mois précédent
   * @returns Le ending balance calculé localement
   */
  calculateLocalEndingBalance(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
    rollover = 0,
  ): number {
    return BudgetFormulas.calculateAllMetrics(
      budgetLines,
      transactions,
      rollover,
    ).endingBalance;
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
