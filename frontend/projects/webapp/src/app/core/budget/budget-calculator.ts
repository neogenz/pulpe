import { Injectable } from '@angular/core';
import { type Transaction, type BudgetLine } from '@pulpe/shared';

/**
 * Interface pour l'affichage des éléments de budget avec solde cumulatif
 */
export interface BudgetItemDisplay {
  /** Données originales (budget line OU transaction) */
  item: BudgetLine | Transaction;
  /** Solde cumulatif calculé en centimes */
  cumulativeBalance: number;
  /** Ordre d'affichage selon les règles métier */
  displayOrder: number;
  /** Type d'élément pour différencier budget lines et transactions */
  itemType: 'budget_line' | 'transaction';
}

@Injectable()
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
   * Calcule le montant total des transactions réelles
   * Note: Dans le contexte métier, les transactions manuelles représentent les dépenses variables
   * qui sont catégorisées comme expense dans le système
   */
  calculateActualTransactionsAmount(transactions: Transaction[]): number {
    return transactions
      .filter((transaction) => transaction.kind === 'expense')
      .reduce((total, transaction) => total + transaction.amount, 0);
  }

  /**
   * Combine et trie les budget lines et transactions avec calcul du solde cumulatif
   * Ordre: revenus → épargnes → dépenses (budget lines en premier, puis transactions)
   */
  composeBudgetItemsWithBalance(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemDisplay[] {
    const items: BudgetItemDisplay[] = [];

    // Helper pour déterminer l'ordre de tri par type
    const getKindOrder = (kind: string): number => {
      switch (kind) {
        case 'income':
          return 1;
        case 'saving':
          return 2;
        case 'expense':
          return 3;
        default:
          return 4;
      }
    };

    // Helper pour déterminer la valeur avec signe selon les règles métier
    const getSignedAmount = (kind: string, amount: number): number => {
      switch (kind) {
        case 'income':
          return amount; // Positif
        case 'expense':
        case 'saving':
          return -amount; // Négatif
        default:
          return 0;
      }
    };

    // Ajouter les budget lines avec ordre
    budgetLines.forEach((line, index) => {
      items.push({
        item: line,
        cumulativeBalance: 0, // Sera calculé après tri
        displayOrder: getKindOrder(line.kind) * 1000 + index, // Budget lines en premier
        itemType: 'budget_line',
      });
    });

    // Ajouter les transactions avec ordre
    transactions.forEach((transaction, index) => {
      items.push({
        item: transaction,
        cumulativeBalance: 0, // Sera calculé après tri
        displayOrder: getKindOrder(transaction.kind) * 1000 + 500 + index, // Transactions après budget lines
        itemType: 'transaction',
      });
    });

    // Trier selon les règles métier
    items.sort((a, b) => a.displayOrder - b.displayOrder);

    // Calculer les soldes cumulatifs
    let runningBalance = 0;
    items.forEach((item) => {
      const signedAmount = getSignedAmount(item.item.kind, item.item.amount);
      runningBalance += signedAmount;
      item.cumulativeBalance = runningBalance;
    });

    return items;
  }
}
