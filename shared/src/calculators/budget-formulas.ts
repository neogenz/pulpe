/**
 * @fileoverview BUDGET FORMULAS - Single Source of Truth pour les calculs métier
 *
 * Implémentation des formules SPECS.md section 3 "Modèle de Calcul"
 * Fonctions pures, testables, réutilisables côté frontend ET backend
 *
 * Formules SPECS (avec logique d'enveloppe):
 * - Pour chaque ligne: effective = max(line.amount, consumed_matching_txs)
 * - available_M = income_M + rollover_M
 * - ending_balance_M = available_M - expenses_M
 * - remaining_M = ending_balance_M
 *
 * NOTE: L'import utilise l'extension .js (pas .ts) - exigence ESM Node.js
 * Voir shared/README.md section "Résolution des Modules ESM"
 */

import type { TransactionKind } from '../types.js';

/**
 * Interface d'abstraction pour les entités financières
 * Utilisée pour unifier budget_lines et transactions dans les calculs
 *
 * @example
 * // Pour une ligne budgétaire (prévision)
 * { kind: 'income', amount: 5000 }  // Salaire prévu
 *
 * @example
 * // Pour une transaction (réalisation)
 * { kind: 'expense', amount: 150 }  // Restaurant saisi
 */
interface FinancialItem {
  kind: TransactionKind;
  amount: number;
  checkedAt?: string | null;
}

/**
 * Extended interface for envelope-aware calculations
 * Requires `id` on budget lines and `budgetLineId` on transactions
 */
interface FinancialItemWithId extends FinancialItem {
  id: string;
  isRollover?: boolean;
}

interface TransactionWithBudgetLineId extends FinancialItem {
  budgetLineId?: string | null;
}

/**
 * Returns true for outflow kinds (expense, saving).
 * Mirrors iOS `TransactionKind.isOutflow`.
 */
export function isOutflowKind(kind: TransactionKind): boolean {
  return kind === 'expense' || kind === 'saving';
}

/**
 * Classe contenant toutes les formules métier selon SPECS
 * Toutes les méthodes sont statiques et pures (pas d'effets de bord)
 */
export class BudgetFormulas {
  static #indexByLineId(
    transactions: TransactionWithBudgetLineId[],
  ): Map<string, TransactionWithBudgetLineId[]> {
    const map = new Map<string, TransactionWithBudgetLineId[]>();
    for (const tx of transactions) {
      const key = tx.budgetLineId ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return map;
  }

  static #calculateEnvelopeTotal(
    budgetLines: FinancialItemWithId[],
    txsByLineId: Map<string, TransactionWithBudgetLineId[]>,
    kindFilter: (kind: TransactionKind) => boolean,
  ): number {
    let total = 0;

    for (const line of budgetLines) {
      if (!kindFilter(line.kind)) continue;
      const consumed = (txsByLineId.get(line.id) ?? [])
        .filter((tx) => kindFilter(tx.kind))
        .reduce((sum, tx) => sum + tx.amount, 0);
      total += Math.max(line.amount, consumed);
    }

    for (const tx of txsByLineId.get('') ?? []) {
      if (kindFilter(tx.kind)) {
        total += tx.amount;
      }
    }

    return total;
  }

  /** Total income with envelope logic + kind filter. */
  static calculateTotalIncome(
    budgetLines: FinancialItemWithId[],
    transactions: TransactionWithBudgetLineId[] = [],
  ): number {
    return this.#calculateEnvelopeTotal(
      budgetLines,
      this.#indexByLineId(transactions),
      (kind) => kind === 'income',
    );
  }

  /** Total expenses (expense + saving) with envelope logic + kind filter. */
  static calculateTotalExpenses(
    budgetLines: FinancialItemWithId[],
    transactions: TransactionWithBudgetLineId[] = [],
  ): number {
    return this.#calculateEnvelopeTotal(
      budgetLines,
      this.#indexByLineId(transactions),
      isOutflowKind,
    );
  }

  /** Total savings with envelope logic + kind filter. */
  static calculateTotalSavings(
    budgetLines: FinancialItemWithId[],
    transactions: TransactionWithBudgetLineId[] = [],
  ): number {
    return this.#calculateEnvelopeTotal(
      budgetLines,
      this.#indexByLineId(transactions),
      (kind) => kind === 'saving',
    );
  }

  /**
   * Calcule le revenu réalisé (uniquement les éléments pointés)
   * Formule: Σ(items WHERE kind = 'income' AND checkedAt != null)
   *
   * @param budgetLines - Lignes budgétaires planifiées
   * @param transactions - Transactions réelles
   * @returns Montant total des revenus pointés
   */
  static calculateRealizedIncome(
    budgetLines: FinancialItemWithId[],
    transactions: TransactionWithBudgetLineId[] = [],
  ): number {
    const checkedBudgetIncome = budgetLines
      .filter((line) => line.checkedAt != null && line.kind === 'income')
      .reduce((sum, line) => sum + line.amount, 0);

    const checkedTransactionIncome = transactions
      .filter((t) => t.checkedAt != null && t.kind === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    return checkedBudgetIncome + checkedTransactionIncome;
  }

  /**
   * Calcule les dépenses réalisées (uniquement les éléments pointés) avec logique d'enveloppe
   *
   * Règle métier:
   * - Pour une prévision pointée, on utilise max(montant_enveloppe, montant_consommé_par_transactions)
   * - Les transactions allouées à une prévision pointée ne sont pas comptées une deuxième fois
   * - Les transactions libres (sans budgetLineId) pointées sont comptées directement
   *
   * @param budgetLines - Lignes budgétaires planifiées avec IDs
   * @param transactions - Transactions réelles avec budgetLineId optionnel
   * @returns Montant total des dépenses + épargnes pointées (sans double comptage)
   */
  static calculateRealizedExpenses(
    budgetLines: FinancialItemWithId[],
    transactions: TransactionWithBudgetLineId[] = [],
  ): number {
    const txsByLineId = this.#indexByLineId(transactions);
    let total = 0;

    for (const line of budgetLines) {
      if (!isOutflowKind(line.kind)) continue;

      const consumed = (txsByLineId.get(line.id) ?? [])
        .filter((tx) => tx.checkedAt != null && isOutflowKind(tx.kind))
        .reduce((sum, tx) => sum + tx.amount, 0);

      if (line.checkedAt != null) {
        total += Math.max(line.amount, consumed);
      } else {
        total += consumed;
      }
    }

    for (const tx of txsByLineId.get('') ?? []) {
      if (tx.checkedAt != null && isOutflowKind(tx.kind)) {
        total += tx.amount;
      }
    }

    return total;
  }

  /**
   * Calcule le solde réalisé (basé uniquement sur les éléments pointés)
   * Formule: solde_réalisé = Σ(revenus pointés) - Σ(dépenses + épargnes pointées)
   *
   * @param budgetLines - Lignes budgétaires planifiées
   * @param transactions - Transactions réelles
   * @returns Solde calculé depuis les éléments pointés uniquement
   */
  static calculateRealizedBalance(
    budgetLines: FinancialItemWithId[],
    transactions: TransactionWithBudgetLineId[] = [],
  ): number {
    const realizedIncome = this.calculateRealizedIncome(
      budgetLines,
      transactions,
    );
    const realizedExpenses = this.calculateRealizedExpenses(
      budgetLines,
      transactions,
    );
    return realizedIncome - realizedExpenses;
  }

  /**
   * Calcule le montant disponible total
   * Formule SPECS: available_M = income_M + rollover_M
   *
   * @param totalIncome - Revenus totaux calculés
   * @param rollover - Report du mois précédent (peut être négatif)
   * @returns Montant total disponible pour le mois
   */
  static calculateAvailable(totalIncome: number, rollover: number): number {
    return totalIncome + rollover;
  }

  /**
   * Calcule le ending balance selon les SPECS
   * Formule SPECS: ending_balance_M = available_M - expenses_M
   *
   * @param available - Montant disponible total
   * @param totalExpenses - Dépenses totales calculées
   * @returns Solde de fin de mois
   */
  static calculateEndingBalance(
    available: number,
    totalExpenses: number,
  ): number {
    return available - totalExpenses;
  }

  /**
   * Calcule le montant restant à dépenser
   * Formule SPECS: remaining_M = available_M - expenses_M
   * Note: remaining = ending_balance dans les SPECS
   *
   * @param available - Montant disponible total
   * @param totalExpenses - Dépenses totales calculées
   * @returns Montant restant à dépenser
   */
  static calculateRemaining(available: number, totalExpenses: number): number {
    return this.calculateEndingBalance(available, totalExpenses);
  }

  /**
   * Calcule toutes les métriques avec logique d'enveloppe
   *
   * Business Rule:
   * - Les transactions allouées sont "couvertes" par leur enveloppe
   * - Seul le DÉPASSEMENT (consumed > envelope.amount) impacte le budget
   * - Les transactions libres impactent directement le budget
   *
   * @param budgetLines - Lignes budgétaires avec IDs (pour calcul enveloppe)
   * @param transactions - Transactions avec budgetLineId optionnel
   * @param rollover - Report du mois précédent
   * @returns Toutes les métriques calculées avec logique d'enveloppe
   */
  static calculateAllMetrics(
    budgetLines: FinancialItemWithId[],
    transactions: TransactionWithBudgetLineId[] = [],
    rollover: number = 0,
  ) {
    const txsByLineId = this.#indexByLineId(transactions);
    const totalIncome = this.#calculateEnvelopeTotal(
      budgetLines,
      txsByLineId,
      (kind) => kind === 'income',
    );
    const totalExpenses = this.#calculateEnvelopeTotal(
      budgetLines,
      txsByLineId,
      isOutflowKind,
    );
    const totalSavings = this.#calculateEnvelopeTotal(
      budgetLines,
      txsByLineId,
      (kind) => kind === 'saving',
    );
    const available = this.calculateAvailable(totalIncome, rollover);
    const endingBalance = this.calculateEndingBalance(available, totalExpenses);
    const remaining = endingBalance;

    return {
      totalIncome,
      totalExpenses,
      totalSavings,
      available,
      endingBalance,
      remaining,
      rollover,
    };
  }

  /**
   * Calcule le rollover pour un budget donné (port TypeScript de get_budget_with_rollover SQL).
   *
   * QUINZAINE RULE:
   * - payDay <= 15 (1ère quinzaine): Budget starts on payDay of SAME month
   * - payDay > 15 (2ème quinzaine): Budget starts on payDay of PREVIOUS month
   *
   * @param budgets - All user budgets with month, year, endingBalance
   * @param targetBudgetId - The budget to calculate rollover for
   * @param payDayOfMonth - Day of month when pay period starts (1-31)
   * @returns Rollover data for the target budget
   */
  static calculateRollover(
    budgets: {
      id: string;
      month: number;
      year: number;
      endingBalance: number | null;
    }[],
    targetBudgetId: string,
    payDayOfMonth: number = 1,
  ): {
    endingBalance: number;
    rollover: number;
    availableToSpend: number;
    previousBudgetId: string | null;
  } {
    const payDay = Math.max(1, Math.min(31, payDayOfMonth));

    const budgetsWithSortDate = budgets.map((b) => ({
      ...b,
      endingBalance: b.endingBalance ?? 0,
      sortDate: this.#calculateBudgetStartDate(b.year, b.month, payDay),
    }));

    budgetsWithSortDate.sort(
      (a, b) => a.sortDate.getTime() - b.sortDate.getTime(),
    );

    const targetIndex = budgetsWithSortDate.findIndex(
      (b) => b.id === targetBudgetId,
    );

    if (targetIndex === -1) {
      return {
        endingBalance: 0,
        rollover: 0,
        availableToSpend: 0,
        previousBudgetId: null,
      };
    }

    const target = budgetsWithSortDate[targetIndex];

    let rollover = 0;
    for (let i = 0; i < targetIndex; i++) {
      rollover += budgetsWithSortDate[i].endingBalance;
    }

    let availableToSpend = 0;
    for (let i = 0; i <= targetIndex; i++) {
      availableToSpend += budgetsWithSortDate[i].endingBalance;
    }

    const previousBudgetId =
      targetIndex > 0 ? budgetsWithSortDate[targetIndex - 1].id : null;

    return {
      endingBalance: target.endingBalance,
      rollover,
      availableToSpend,
      previousBudgetId,
    };
  }

  static #calculateBudgetStartDate(
    year: number,
    month: number,
    payDay: number,
  ): Date {
    if (payDay <= 15) {
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const clampedDay = Math.min(payDay, lastDayOfMonth);
      return new Date(year, month - 1, clampedDay);
    }

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const lastDayOfPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    const clampedDay = Math.min(payDay, lastDayOfPrevMonth);
    return new Date(prevYear, prevMonth - 1, clampedDay);
  }

  static validateMetricsCoherence(
    metrics: ReturnType<typeof BudgetFormulas.calculateAllMetrics>,
  ): boolean {
    // Tolérance epsilon pour les comparaisons de nombres décimaux
    const EPSILON = 0.01;

    // Vérifications de base : revenus et dépenses ne peuvent pas être négatifs
    // Note: endingBalance et rollover peuvent être négatifs (déficit autorisé)
    if (metrics.totalIncome < 0) {
      return false; // Les revenus ne peuvent pas être négatifs
    }

    if (metrics.totalExpenses < 0) {
      return false; // Les dépenses ne peuvent pas être négatives
    }

    // Vérification formule SPECS: available = totalIncome + rollover
    const expectedAvailable = metrics.totalIncome + metrics.rollover;
    if (Math.abs(metrics.available - expectedAvailable) > EPSILON) {
      return false;
    }

    // Vérification formule SPECS: endingBalance = available - totalExpenses
    const expectedEndingBalance = metrics.available - metrics.totalExpenses;
    if (Math.abs(metrics.endingBalance - expectedEndingBalance) > EPSILON) {
      return false;
    }

    // Vérification formule SPECS: remaining = endingBalance
    if (Math.abs(metrics.remaining - metrics.endingBalance) > EPSILON) {
      return false;
    }

    return true;
  }
}
