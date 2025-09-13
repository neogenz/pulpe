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
 */

import type { TransactionKind } from '../types';

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
