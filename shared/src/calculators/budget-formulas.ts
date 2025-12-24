/**
 * @fileoverview BUDGET FORMULAS - Single Source of Truth pour les calculs métier
 *
 * Implémentation des formules SPECS.md section 3 "Modèle de Calcul"
 * Fonctions pures, testables, réutilisables côté frontend ET backend
 *
 * Formules SPECS:
 * - available_M = income_M + rollover_M
 * - expenses_M = Σ(budget_lines WHERE type IN ('expense', 'saving')) + Σ(transactions WHERE type IN ('expense', 'saving'))
 * - ending_balance_M = available_M - expenses_M
 * - remaining_M = available_M - expenses_M
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
 * { id: 'bl-1', kind: 'income', amount: 5000 }  // Salaire prévu
 *
 * @example
 * // Pour une transaction (réalisation)
 * { kind: 'expense', amount: 150, budgetLineId: 'bl-1' }  // Transaction allouée
 */
interface FinancialItem {
  kind: TransactionKind;
  amount: number;
  id?: string;
  budgetLineId?: string | null;
}

/**
 * Classe contenant toutes les formules métier selon SPECS
 * Toutes les méthodes sont statiques et pures (pas d'effets de bord)
 */
export class BudgetFormulas {
  /**
   * Calcule le revenu total depuis les budget lines et transactions
   * Formule: Σ(items WHERE kind = 'income')
   *
   * @param budgetLines - Lignes budgétaires planifiées
   * @param transactions - Transactions réelles
   * @returns Montant total des revenus
   */
  static calculateTotalIncome(
    budgetLines: FinancialItem[],
    transactions: FinancialItem[] = [],
  ): number {
    const budgetIncome = budgetLines
      .filter((line) => line.kind === 'income')
      .reduce((sum, line) => sum + line.amount, 0);

    const transactionIncome = transactions
      .filter((t) => t.kind === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    return budgetIncome + transactionIncome;
  }

  /**
   * Calcule les dépenses totales (expenses + savings) depuis les budget lines et transactions
   *
   * Formule corrigée:
   * expenses_M = Σ(budget_lines) + Σ(free_transactions) + Σ(envelope_overruns)
   *
   * où:
   * - free_transactions = transactions SANS budgetLineId
   * - envelope_overruns = MAX(0, allocated_transactions_total - budget_line_amount) pour chaque enveloppe
   *
   * Note SPECS: "Le saving est volontairement traité comme une expense dans les calculs"
   *
   * @param budgetLines - Lignes budgétaires planifiées (avec id optionnel pour les enveloppes)
   * @param transactions - Transactions réelles (avec budgetLineId optionnel pour les allocations)
   * @returns Montant total des dépenses + épargnes
   */
  static calculateTotalExpenses(
    budgetLines: FinancialItem[],
    transactions: FinancialItem[] = [],
  ): number {
    const isExpenseOrSaving = (item: FinancialItem) =>
      item.kind === 'expense' || item.kind === 'saving';

    const budgetExpenses = budgetLines
      .filter(isExpenseOrSaving)
      .reduce((sum, line) => sum + line.amount, 0);

    const expenseTransactions = transactions.filter(isExpenseOrSaving);

    const freeTransactions = expenseTransactions.filter((t) => !t.budgetLineId);
    const allocatedTransactions = expenseTransactions.filter(
      (t) => t.budgetLineId,
    );

    const freeTransactionExpenses = freeTransactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );

    const envelopeOverruns = this.calculateEnvelopeOverruns(
      budgetLines,
      allocatedTransactions,
    );

    return budgetExpenses + freeTransactionExpenses + envelopeOverruns;
  }

  /**
   * Calcule le dépassement total des enveloppes par les transactions allouées
   *
   * Pour chaque enveloppe, si le total des transactions allouées dépasse le montant
   * de l'enveloppe, seul le dépassement est compté.
   *
   * @param budgetLines - Lignes budgétaires avec leurs id
   * @param allocatedTransactions - Transactions allouées (avec budgetLineId)
   * @returns Total des dépassements d'enveloppes
   */
  private static calculateEnvelopeOverruns(
    budgetLines: FinancialItem[],
    allocatedTransactions: FinancialItem[],
  ): number {
    if (allocatedTransactions.length === 0) {
      return 0;
    }

    const budgetLineAmounts = new Map<string, number>();
    for (const line of budgetLines) {
      if (line.id && (line.kind === 'expense' || line.kind === 'saving')) {
        budgetLineAmounts.set(line.id, line.amount);
      }
    }

    const allocatedTotals = new Map<string, number>();
    for (const t of allocatedTransactions) {
      if (t.budgetLineId) {
        const current = allocatedTotals.get(t.budgetLineId) ?? 0;
        allocatedTotals.set(t.budgetLineId, current + t.amount);
      }
    }

    let totalOverruns = 0;
    for (const [budgetLineId, allocatedTotal] of allocatedTotals) {
      const envelopeAmount = budgetLineAmounts.get(budgetLineId);
      if (envelopeAmount !== undefined) {
        const overrun = Math.max(0, allocatedTotal - envelopeAmount);
        totalOverruns += overrun;
      } else {
        totalOverruns += allocatedTotal;
      }
    }

    return totalOverruns;
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
   * Calcule toutes les métriques en une seule fois
   * Optimisation pour éviter les calculs redondants
   *
   * @param budgetLines - Lignes budgétaires planifiées
   * @param transactions - Transactions réelles
   * @param rollover - Report du mois précédent
   * @returns Toutes les métriques calculées
   */
  static calculateAllMetrics(
    budgetLines: FinancialItem[],
    transactions: FinancialItem[] = [],
    rollover: number = 0,
  ) {
    const totalIncome = this.calculateTotalIncome(budgetLines, transactions);
    const totalExpenses = this.calculateTotalExpenses(
      budgetLines,
      transactions,
    );
    const available = this.calculateAvailable(totalIncome, rollover);
    const endingBalance = this.calculateEndingBalance(available, totalExpenses);
    const remaining = endingBalance; // Same as ending balance per SPECS

    return {
      totalIncome,
      totalExpenses,
      available,
      endingBalance,
      remaining,
      rollover,
    };
  }

  /**
   * Valide la cohérence des calculs selon les règles métier
   * Utile pour les tests et la validation
   *
   * @param metrics - Métriques calculées
   * @returns True si cohérent, false sinon
   */
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
