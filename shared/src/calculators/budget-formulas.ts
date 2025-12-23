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
 * Interface pour les budget lines avec ID (nécessaire pour la logique d'enveloppe)
 */
export interface BudgetLineWithId extends FinancialItem {
  id: string;
}

/**
 * Interface pour les transactions pouvant être allouées à une enveloppe
 */
export interface AllocatableTransaction extends FinancialItem {
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

  // ==========================================
  // MÉTHODES AVEC LOGIQUE D'ENVELOPPE
  // ==========================================

  /**
   * Calcule l'impact effectif des transactions sur le budget en tenant compte des enveloppes.
   *
   * Logique d'enveloppe:
   * - Transactions libres (sans budgetLineId): impact complet
   * - Transactions allouées: seul l'excès par rapport au montant de l'enveloppe compte
   *
   * @example
   * // Enveloppe de 500 CHF, transaction de 100 CHF → impact = 0 (couvert par l'enveloppe)
   * // Enveloppe de 500 CHF, transaction de 600 CHF → impact = 100 (excès)
   *
   * @param budgetLines - Budget lines avec leur ID
   * @param transactions - Transactions avec leur budgetLineId optionnel
   * @returns Impact net des transactions (négatif pour dépenses, positif pour revenus)
   */
  static calculateEffectiveTransactionImpact(
    budgetLines: BudgetLineWithId[],
    transactions: AllocatableTransaction[],
  ): number {
    const budgetLineIds = new Set(budgetLines.map((line) => line.id));

    // 1. Transactions libres: celles sans budgetLineId ou allouées à des lignes inexistantes
    const freeTransactions = transactions.filter(
      (tx) => !tx.budgetLineId || !budgetLineIds.has(tx.budgetLineId),
    );

    let impact = freeTransactions.reduce((sum, tx) => {
      const sign = tx.kind === 'income' ? 1 : -1;
      return sum + sign * tx.amount;
    }, 0);

    // 2. Pour chaque budget line, vérifier si les transactions allouées dépassent l'enveloppe
    for (const line of budgetLines) {
      const allocatedTransactions = transactions.filter(
        (tx) => tx.budgetLineId === line.id,
      );

      if (allocatedTransactions.length > 0) {
        const allocatedTotal = allocatedTransactions.reduce(
          (sum, tx) => sum + tx.amount,
          0,
        );
        const excess = allocatedTotal - line.amount;

        if (excess > 0) {
          // Seul l'excès impacte le budget
          if (line.kind === 'expense' || line.kind === 'saving') {
            impact -= excess; // Dépense supplémentaire réduit le disponible
          } else if (line.kind === 'income') {
            impact += excess; // Revenu supplémentaire augmente le disponible
          }
        }
      }
    }

    return impact;
  }

  /**
   * Calcule les dépenses totales avec la logique d'enveloppe.
   *
   * Formule:
   * - Somme des budget lines (expense + saving)
   * - Plus les transactions libres (expense + saving)
   * - Plus l'excès des transactions allouées par rapport à leur enveloppe
   *
   * @param budgetLines - Budget lines avec leur ID
   * @param transactions - Transactions avec leur budgetLineId optionnel
   * @returns Montant total des dépenses effectives
   */
  static calculateTotalExpensesWithEnvelopes(
    budgetLines: BudgetLineWithId[],
    transactions: AllocatableTransaction[],
  ): number {
    // Dépenses des budget lines (enveloppes)
    const budgetExpenses = budgetLines
      .filter((line) => line.kind === 'expense' || line.kind === 'saving')
      .reduce((sum, line) => sum + line.amount, 0);

    const budgetLineIds = new Set(budgetLines.map((line) => line.id));

    // Transactions libres (sans allocation)
    const freeTransactionExpenses = transactions
      .filter(
        (tx) =>
          (tx.kind === 'expense' || tx.kind === 'saving') &&
          (!tx.budgetLineId || !budgetLineIds.has(tx.budgetLineId)),
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Excès des transactions allouées
    let allocatedExcess = 0;
    for (const line of budgetLines) {
      if (line.kind === 'expense' || line.kind === 'saving') {
        const allocatedTransactions = transactions.filter(
          (tx) => tx.budgetLineId === line.id,
        );
        if (allocatedTransactions.length > 0) {
          const allocatedTotal = allocatedTransactions.reduce(
            (sum, tx) => sum + tx.amount,
            0,
          );
          const excess = allocatedTotal - line.amount;
          if (excess > 0) {
            allocatedExcess += excess;
          }
        }
      }
    }

    return budgetExpenses + freeTransactionExpenses + allocatedExcess;
  }

  /**
   * Calcule les revenus totaux avec la logique d'enveloppe.
   *
   * @param budgetLines - Budget lines avec leur ID
   * @param transactions - Transactions avec leur budgetLineId optionnel
   * @returns Montant total des revenus effectifs
   */
  static calculateTotalIncomeWithEnvelopes(
    budgetLines: BudgetLineWithId[],
    transactions: AllocatableTransaction[],
  ): number {
    // Revenus des budget lines
    const budgetIncome = budgetLines
      .filter((line) => line.kind === 'income')
      .reduce((sum, line) => sum + line.amount, 0);

    const budgetLineIds = new Set(budgetLines.map((line) => line.id));

    // Transactions libres (sans allocation)
    const freeTransactionIncome = transactions
      .filter(
        (tx) =>
          tx.kind === 'income' &&
          (!tx.budgetLineId || !budgetLineIds.has(tx.budgetLineId)),
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Excès des transactions allouées (revenus supplémentaires)
    let allocatedExcess = 0;
    for (const line of budgetLines) {
      if (line.kind === 'income') {
        const allocatedTransactions = transactions.filter(
          (tx) => tx.budgetLineId === line.id,
        );
        if (allocatedTransactions.length > 0) {
          const allocatedTotal = allocatedTransactions.reduce(
            (sum, tx) => sum + tx.amount,
            0,
          );
          const excess = allocatedTotal - line.amount;
          if (excess > 0) {
            allocatedExcess += excess;
          }
        }
      }
    }

    return budgetIncome + freeTransactionIncome + allocatedExcess;
  }

  /**
   * Calcule toutes les métriques avec la logique d'enveloppe.
   *
   * Cette méthode est la version principale à utiliser pour les calculs budgétaires
   * quand les transactions peuvent être allouées à des enveloppes.
   *
   * @param budgetLines - Budget lines avec leur ID
   * @param transactions - Transactions avec leur budgetLineId optionnel
   * @param rollover - Report du mois précédent
   * @returns Toutes les métriques calculées
   */
  static calculateAllMetricsWithEnvelopes(
    budgetLines: BudgetLineWithId[],
    transactions: AllocatableTransaction[] = [],
    rollover: number = 0,
  ) {
    const totalIncome = this.calculateTotalIncomeWithEnvelopes(
      budgetLines,
      transactions,
    );
    const totalExpenses = this.calculateTotalExpensesWithEnvelopes(
      budgetLines,
      transactions,
    );
    const available = this.calculateAvailable(totalIncome, rollover);
    const endingBalance = this.calculateEndingBalance(available, totalExpenses);
    const remaining = endingBalance;

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
