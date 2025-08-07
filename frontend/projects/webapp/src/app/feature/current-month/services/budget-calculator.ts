import { Injectable } from '@angular/core';
import { Transaction, BudgetLine } from '@pulpe/shared';

@Injectable()
export class BudgetCalculator {
  /**
   * Calcule le Fixed Block selon les spécifications métier
   * Fixed Block = somme de toutes les dépenses fixes + épargne planifiée (depuis les budget lines)
   */
  calculateFixedBlock(budgetLines: BudgetLine[]): number {
    return budgetLines
      .filter(
        (line) =>
          line.kind === 'FIXED_EXPENSE' || line.kind === 'SAVINGS_CONTRIBUTION',
      )
      .reduce((total, line) => total + line.amount, 0);
  }

  /**
   * Calcule le revenu planifié depuis les budget lines
   */
  calculatePlannedIncome(budgetLines: BudgetLine[]): number {
    return budgetLines
      .filter((line) => line.kind === 'INCOME')
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
   * Calcule le montant total des transactions réelles
   * Note: Dans le contexte métier, les transactions manuelles représentent les dépenses variables
   * qui sont catégorisées comme FIXED_EXPENSE dans le système
   */
  calculateActualTransactionsAmount(transactions: Transaction[]): number {
    return transactions
      .filter((transaction) => transaction.kind === 'FIXED_EXPENSE')
      .reduce((total, transaction) => total + transaction.amount, 0);
  }

  /**
   * Calcule le budget restant selon les spécifications métier
   * Budget restant = Living Allowance - Transactions réelles
   *
   * Note: Cette méthode est conservée pour les tests, mais dans l'application
   * il est préférable d'utiliser les computed properties de CurrentMonthState
   * pour éviter de recalculer les mêmes valeurs
   */
  calculateRemainingBudget(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): number {
    const livingAllowance = this.calculateLivingAllowance(budgetLines);
    const actualTransactions =
      this.calculateActualTransactionsAmount(transactions);
    return livingAllowance - actualTransactions;
  }
}
