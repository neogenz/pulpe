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
    return transactions.reduce((total, transaction) => {
      switch (transaction.kind) {
        case 'income':
          return total + transaction.amount;
        case 'expense':
        case 'saving':
          return total - transaction.amount;
        default:
          return total;
      }
    }, 0);
  }

  /**
   * Combine et trie les budget lines et transactions avec calcul du solde cumulatif
   * Ordre: revenus → épargnes → dépenses (budget lines en premier, puis transactions)
   */
  composeBudgetItemsWithBalance(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemDisplay[] {
    // Constants pour éviter les magic numbers
    const DISPLAY_ORDER = {
      KIND_MULTIPLIER: 1000,
      TRANSACTION_OFFSET: 500,
      INCOME: 1,
      SAVING: 2,
      EXPENSE: 3,
      DEFAULT: 4,
    } as const;

    const items: BudgetItemDisplay[] = [];

    // Helper pour déterminer l'ordre de tri par type
    const getKindOrder = (kind: string): number => {
      switch (kind) {
        case 'income':
          return DISPLAY_ORDER.INCOME;
        case 'saving':
          return DISPLAY_ORDER.SAVING;
        case 'expense':
          return DISPLAY_ORDER.EXPENSE;
        default:
          return DISPLAY_ORDER.DEFAULT;
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
        displayOrder:
          getKindOrder(line.kind) * DISPLAY_ORDER.KIND_MULTIPLIER + index,
        itemType: 'budget_line',
      });
    });

    // Ajouter les transactions avec ordre
    transactions.forEach((transaction, index) => {
      items.push({
        item: transaction,
        cumulativeBalance: 0, // Sera calculé après tri
        displayOrder:
          getKindOrder(transaction.kind) * DISPLAY_ORDER.KIND_MULTIPLIER +
          DISPLAY_ORDER.TRANSACTION_OFFSET +
          index,
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
