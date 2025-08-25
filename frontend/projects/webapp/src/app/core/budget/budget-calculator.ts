import { Injectable } from '@angular/core';
import {
  type Transaction,
  type BudgetLine,
  type TransactionKind,
  type TransactionRecurrence,
} from '@pulpe/shared';

/**
 * Interface for budget items with cumulative balance calculation
 * Used internally for financial calculations
 */
export interface BudgetItemWithBalance {
  /** Original data (budget line OR transaction) */
  item: BudgetLine | Transaction;
  /** Cumulative balance calculated in CHF */
  cumulativeBalance: number;
  /** Display order according to business rules */
  displayOrder: number;
  /** Item type to differentiate budget lines and transactions */
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
    return transactions.reduce(
      (total, transaction) =>
        total + this.#getSignedAmount(transaction.kind, transaction.amount),
      0,
    );
  }

  // Configuration des ordres d'affichage pour éviter les magic numbers
  readonly #DISPLAY_ORDER_CONFIG = {
    KIND_MULTIPLIER: 1000,
    RECURRENCE_MULTIPLIER: 10000,
    TRANSACTION_OFFSET: 500, // Valeur originale pour compatibilité avec ancienne méthode
    TRANSACTION_OFFSET_GROUPED: 20000, // Nouvelle valeur pour méthode groupée
    INCOME: 1,
    SAVING: 2,
    EXPENSE: 3,
    DEFAULT: 4,
    RECURRENCE_FIXED: 1,
    RECURRENCE_ONE_OFF: 2,
    RECURRENCE_DEFAULT: 3,
  } as const;

  /**
   * Combines and sorts budget lines and transactions with cumulative balance calculation
   * Order: income → savings → expenses (budget lines first, then transactions)
   * @deprecated Use composeBudgetItemsWithBalanceGrouped instead for better organization
   */
  composeBudgetItemsWithBalance(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemWithBalance[] {
    const items = this.#createDisplayItems(budgetLines, transactions);
    this.#sortItemsByBusinessRules(items);
    this.#calculateCumulativeBalances(items);

    return items;
  }

  /**
   * Combines and sorts budget lines (grouped by recurrence) and transactions with cumulative balance calculation
   * Order:
   * 1. Budget lines "fixed" (income → savings → expenses)
   * 2. Budget lines "one_off" (income → savings → expenses)
   * 3. Transactions (income → savings → expenses)
   */
  composeBudgetItemsWithBalanceGrouped(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemWithBalance[] {
    const items = this.#createDisplayItemsGrouped(budgetLines, transactions);
    this.#sortItemsByBusinessRulesGrouped(items);
    this.#calculateCumulativeBalances(items);

    return items;
  }

  /**
   * Crée les éléments d'affichage avec leurs ordres de tri
   */
  #createDisplayItems(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemWithBalance[] {
    const items: BudgetItemWithBalance[] = [];

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
   * Calcule l'ordre d'affichage groupé par récurrence selon les règles métier
   */
  #calculateDisplayOrderGrouped(
    kind: TransactionKind,
    recurrence: TransactionRecurrence,
    index: number,
    itemType: 'budget_line' | 'transaction',
  ): number {
    const recurrenceOrder = this.#getRecurrenceOrder(recurrence);
    const kindOrder = this.#getKindOrder(kind);

    // Structure de l'ordre: [RÉCURRENCE][KIND][TYPE][INDEX]
    const baseOrder =
      recurrenceOrder * this.#DISPLAY_ORDER_CONFIG.RECURRENCE_MULTIPLIER +
      kindOrder * this.#DISPLAY_ORDER_CONFIG.KIND_MULTIPLIER;

    const typeOffset =
      itemType === 'transaction'
        ? this.#DISPLAY_ORDER_CONFIG.TRANSACTION_OFFSET_GROUPED
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
   * Détermine l'ordre de tri par récurrence selon les règles métier
   */
  #getRecurrenceOrder(recurrence: TransactionRecurrence): number {
    switch (recurrence) {
      case 'fixed':
        return this.#DISPLAY_ORDER_CONFIG.RECURRENCE_FIXED;
      case 'one_off':
        return this.#DISPLAY_ORDER_CONFIG.RECURRENCE_ONE_OFF;
      case 'variable':
        return this.#DISPLAY_ORDER_CONFIG.RECURRENCE_FIXED; // Traiter comme fixed
      default:
        return this.#DISPLAY_ORDER_CONFIG.RECURRENCE_DEFAULT;
    }
  }

  /**
   * Trie les éléments selon les règles métier
   */
  #sortItemsByBusinessRules(items: BudgetItemWithBalance[]): void {
    items.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  /**
   * Crée les éléments d'affichage groupés par récurrence avec leurs ordres de tri
   */
  #createDisplayItemsGrouped(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemWithBalance[] {
    const items: BudgetItemWithBalance[] = [];

    // Ajouter les budget lines avec ordre groupé par récurrence
    budgetLines.forEach((line, index) => {
      items.push({
        item: line,
        cumulativeBalance: 0, // Sera calculé après tri
        displayOrder: this.#calculateDisplayOrderGrouped(
          line.kind,
          line.recurrence,
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
        displayOrder: this.#calculateDisplayOrderGrouped(
          transaction.kind,
          'one_off', // Les transactions n'ont pas de récurrence, on les traite comme one_off
          index,
          'transaction',
        ),
        itemType: 'transaction',
      });
    });

    return items;
  }

  /**
   * Trie les éléments selon les règles métier groupées
   */
  #sortItemsByBusinessRulesGrouped(items: BudgetItemWithBalance[]): void {
    items.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  /**
   * Calcule les soldes cumulatifs pour tous les éléments
   */
  #calculateCumulativeBalances(items: BudgetItemWithBalance[]): void {
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
