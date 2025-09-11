import { Injectable } from '@angular/core';
import {
  type Transaction,
  type BudgetLine,
  type TransactionKind,
} from '@pulpe/shared';

@Injectable({ providedIn: 'root' })
export class BudgetCalculator {
  /**
   * Calcule le revenu planifié depuis les budget lines
   */
  calculatePlannedIncome(budgetLines: BudgetLine[]): number {
    return budgetLines
      .filter((line) => line.kind === 'income')
      .reduce((total, line) => total + line.amount, 0);
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

  /**
   * Calcule le total dépensé (expenses + savings) en INCLUANT les lignes rollover
   */
  calculateTotalSpentIncludingRollover(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): number {
    const budgetSpent = budgetLines
      .filter((line) => line.kind === 'expense' || line.kind === 'saving')
      .reduce((total, line) => total + line.amount, 0);

    const transactionsSpent = transactions
      .filter(
        (transaction) =>
          transaction.kind === 'expense' || transaction.kind === 'saving',
      )
      .reduce((total, transaction) => total + transaction.amount, 0);

    return budgetSpent + transactionsSpent;
  }

  /**
   * Calcule le total dépensé (expenses + savings) en EXCLUANT les lignes rollover
   */
  calculateTotalSpentExcludingRollover(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): number {
    const budgetSpent = budgetLines
      .filter((line) => line.kind === 'expense' || line.kind === 'saving')
      .filter((line) => line.isRollover !== true)
      .reduce((total, line) => total + line.amount, 0);

    const transactionsSpent = transactions
      .filter(
        (transaction) =>
          transaction.kind === 'expense' || transaction.kind === 'saving',
      )
      .reduce((total, transaction) => total + transaction.amount, 0);

    return budgetSpent + transactionsSpent;
  }

  /**
   * Retourne le montant de rollover à partir des budget lines
   */
  calculateRolloverAmount(budgetLines: BudgetLine[]): number {
    const rolloverLine = budgetLines.find((line) => line.isRollover === true);
    if (!rolloverLine) return 0;
    return rolloverLine.kind === 'expense'
      ? -rolloverLine.amount
      : rolloverLine.amount;
  }

  calculateTotalAvailable(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): number {
    const budgetAvailable = budgetLines
      .filter((line) => line.kind === 'income')
      .reduce((total, line) => total + line.amount, 0);

    const transactionsAvailable = transactions
      .filter((transaction) => transaction.kind === 'income')
      .reduce((total, transaction) => total + transaction.amount, 0);

    return budgetAvailable + transactionsAvailable;
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
   * ending_balance = Income - (Expenses + Savings) from ALL sources
   *
   * Cette méthode combine:
   * - Les revenus planifiés (budget lines)
   * - Les dépenses et épargnes planifiées (budget lines)
   * - L'impact des transactions réelles
   *
   * @param budgetLines Les lignes budgétaires planifiées
   * @param transactions Les transactions réelles effectuées
   * @returns Le ending balance calculé localement
   */
  calculateLocalEndingBalance(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): number {
    const available = this.calculateTotalAvailable(budgetLines, transactions);
    const spent = this.calculateTotalSpentIncludingRollover(
      budgetLines,
      transactions,
    );

    return available - spent;
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
