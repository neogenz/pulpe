import { Injectable } from '@angular/core';
import {
  type Transaction,
  type BudgetLine,
  type TransactionKind,
} from '@pulpe/shared';

/**
 * Interface pour l'affichage des éléments de budget avec solde cumulatif
 */
export interface BudgetItemDisplay {
  /** Données originales (budget line OU transaction) */
  item: BudgetLine | Transaction;
  /** Solde cumulatif calculé en CHF francs */
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

  // Configuration des ordres d'affichage pour éviter les magic numbers
  readonly #DISPLAY_ORDER_CONFIG = {
    KIND_MULTIPLIER: 1000,
    TRANSACTION_OFFSET: 500,
    INCOME: 1,
    SAVING: 2,
    EXPENSE: 3,
    DEFAULT: 4,
  } as const;

  /**
   * Combine et trie les budget lines et transactions avec calcul du solde cumulatif
   * Ordre: revenus → épargnes → dépenses (budget lines en premier, puis transactions)
   */
  composeBudgetItemsWithBalance(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemDisplay[] {
    const items = this.#createDisplayItems(budgetLines, transactions);
    this.#sortItemsByBusinessRules(items);
    this.#calculateCumulativeBalances(items);

    return items;
  }

  /**
   * Crée les éléments d'affichage avec leurs ordres de tri
   */
  #createDisplayItems(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemDisplay[] {
    const items: BudgetItemDisplay[] = [];

    // Ajouter les budget lines avec ordre
    budgetLines.forEach((line, index) => {
      items.push({
        item: line,
        cumulativeBalance: 0, // Sera calculé après tri
        displayOrder: this.#calculateDisplayOrder(
          line.kind,
          index,
          'budget_line',
        ),
        itemType: 'budget_line',
      });
    });

    // Ajouter les transactions avec ordre
    transactions.forEach((transaction, index) => {
      items.push({
        item: transaction,
        cumulativeBalance: 0, // Sera calculé après tri
        displayOrder: this.#calculateDisplayOrder(
          transaction.kind,
          index,
          'transaction',
        ),
        itemType: 'transaction',
      });
    });

    return items;
  }

  /**
   * Calcule l'ordre d'affichage selon les règles métier
   */
  #calculateDisplayOrder(
    kind: TransactionKind,
    index: number,
    itemType: 'budget_line' | 'transaction',
  ): number {
    const kindOrder = this.#getKindOrder(kind);
    const baseOrder = kindOrder * this.#DISPLAY_ORDER_CONFIG.KIND_MULTIPLIER;
    const typeOffset =
      itemType === 'transaction'
        ? this.#DISPLAY_ORDER_CONFIG.TRANSACTION_OFFSET
        : 0;

    return baseOrder + typeOffset + index;
  }

  /**
   * Détermine l'ordre de tri par type selon les règles métier
   */
  #getKindOrder(kind: TransactionKind): number {
    switch (kind) {
      case 'income':
        return this.#DISPLAY_ORDER_CONFIG.INCOME;
      case 'saving':
        return this.#DISPLAY_ORDER_CONFIG.SAVING;
      case 'expense':
        return this.#DISPLAY_ORDER_CONFIG.EXPENSE;
      default:
        return this.#DISPLAY_ORDER_CONFIG.DEFAULT;
    }
  }

  /**
   * Trie les éléments selon les règles métier
   */
  #sortItemsByBusinessRules(items: BudgetItemDisplay[]): void {
    items.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  /**
   * Calcule les soldes cumulatifs pour tous les éléments
   */
  #calculateCumulativeBalances(items: BudgetItemDisplay[]): void {
    let runningBalance = 0;
    items.forEach((item) => {
      const signedAmount = this.#getSignedAmount(
        item.item.kind,
        item.item.amount,
      );
      runningBalance += signedAmount;
      item.cumulativeBalance = runningBalance;
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
