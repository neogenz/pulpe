/**
 * BUDGET FORMULAS - Single Source of Truth pour les calculs métier
 *
 * Implémentation des formules SPECS.md section 3 "Modèle de Calcul"
 * Fonctions pures, testables, réutilisables côté frontend ET backend
 *
 * Formules SPECS:
 * - available_M = income_M + rollover_M
 * - expenses_M = Σ(budget_lines WHERE type IN ('expense', 'saving')) + Σ(transactions WHERE type IN ('expense', 'saving'))
 * - ending_balance_M = available_M - expenses_M
 * - remaining_M = available_M - expenses_M
 * - progress_M = (expenses_M ÷ available_M) × 100
 */

import type { TransactionKind } from '../types';

/**
 * Interface pour les entités avec kind et amount
 */
interface FinancialItem {
  kind: TransactionKind;
  amount: number;
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
   * Formule SPECS: expenses_M = Σ(budget_lines WHERE type IN ('expense', 'saving')) + Σ(transactions WHERE type IN ('expense', 'saving'))
   *
   * Note SPECS: "Le saving est volontairement traité comme une expense dans les calculs"
   *
   * @param budgetLines - Lignes budgétaires planifiées
   * @param transactions - Transactions réelles
   * @returns Montant total des dépenses + épargnes
   */
  static calculateTotalExpenses(
    budgetLines: FinancialItem[],
    transactions: FinancialItem[] = [],
  ): number {
    const budgetExpenses = budgetLines
      .filter((line) => line.kind === 'expense' || line.kind === 'saving')
      .reduce((sum, line) => sum + line.amount, 0);

    const transactionExpenses = transactions
      .filter((t) => t.kind === 'expense' || t.kind === 'saving')
      .reduce((sum, t) => sum + t.amount, 0);

    return budgetExpenses + transactionExpenses;
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
   * Calcule la progression du budget (pourcentage consommé)
   * Formule SPECS: progress_M = (expenses_M ÷ available_M) × 100
   *
   * @param totalExpenses - Dépenses totales calculées
   * @param available - Montant disponible total
   * @returns Pourcentage de progression (0-100, peut dépasser 100%)
   */
  static calculateProgress(totalExpenses: number, available: number): number {
    if (available === 0) {
      return totalExpenses > 0 ? 100 : 0;
    }
    return (totalExpenses / available) * 100;
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
    const progress = this.calculateProgress(totalExpenses, available);

    return {
      totalIncome,
      totalExpenses,
      available,
      endingBalance,
      remaining,
      progress,
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
    // Vérifications de base
    if (metrics.totalIncome < 0 || metrics.totalExpenses < 0) {
      return false;
    }

    // available = totalIncome + rollover
    if (
      Math.abs(metrics.available - (metrics.totalIncome + metrics.rollover)) >
      0.01
    ) {
      return false;
    }

    // endingBalance = available - totalExpenses
    if (
      Math.abs(
        metrics.endingBalance - (metrics.available - metrics.totalExpenses),
      ) > 0.01
    ) {
      return false;
    }

    // remaining = endingBalance
    if (Math.abs(metrics.remaining - metrics.endingBalance) > 0.01) {
      return false;
    }

    return true;
  }
}
