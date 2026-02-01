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
  checkedAt?: string | null;
}

/**
 * Extended interface for envelope-aware calculations
 * Requires `id` on budget lines and `budgetLineId` on transactions
 */
interface FinancialItemWithId extends FinancialItem {
  id: string;
}

interface TransactionWithBudgetLineId extends FinancialItem {
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
   * Calcule les dépenses totales avec logique d'enveloppe
   *
   * Business Rule:
   * - Allocated transactions are "covered" by their envelope (budget line)
   * - Only the OVERAGE (consumed > envelope.amount) impacts the budget
   * - Free transactions (no budgetLineId) impact the budget directly
   *
   * @param budgetLines - Budget lines with `id` field
   * @param transactions - Transactions with optional `budgetLineId` field
   * @returns Total expenses accounting for envelope coverage
   */
  static calculateTotalExpensesWithEnvelopes(
    budgetLines: FinancialItemWithId[],
    transactions: TransactionWithBudgetLineId[] = [],
  ): number {
    let total = 0;

    // For each expense/saving budget line, use max(envelope, consumed)
    budgetLines.forEach((line) => {
      if (line.kind === 'expense' || line.kind === 'saving') {
        // Skip virtual rollover lines
        if (line.id.startsWith('rollover-')) return;

        // Calculate consumed amount for this envelope
        const consumed = transactions
          .filter((tx) => tx.budgetLineId === line.id)
          .reduce((sum, tx) => sum + tx.amount, 0);

        const effectiveAmount = Math.max(line.amount, consumed);
        total += effectiveAmount;
      }
    });

    // Add free transactions (those without budgetLineId)
    transactions.forEach((tx) => {
      if (!tx.budgetLineId && (tx.kind === 'expense' || tx.kind === 'saving')) {
        total += tx.amount;
      }
    });

    return total;
  }

  /**
   * Calcule le revenu réalisé (uniquement les éléments cochés)
   * Formule: Σ(items WHERE kind = 'income' AND checkedAt != null)
   *
   * @param budgetLines - Lignes budgétaires planifiées
   * @param transactions - Transactions réelles
   * @returns Montant total des revenus cochés
   */
  static calculateRealizedIncome(
    budgetLines: FinancialItem[],
    transactions: FinancialItem[] = [],
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
   * Calcule les dépenses réalisées (uniquement les éléments cochés) avec logique d'enveloppe
   *
   * Règle métier:
   * - Pour une prévision cochée, on utilise max(montant_enveloppe, montant_consommé_par_transactions)
   * - Les transactions allouées à une prévision cochée ne sont pas comptées une deuxième fois
   * - Les transactions libres (sans budgetLineId) cochées sont comptées directement
   *
   * @param budgetLines - Lignes budgétaires planifiées avec IDs
   * @param transactions - Transactions réelles avec budgetLineId optionnel
   * @returns Montant total des dépenses + épargnes cochées (sans double comptage)
   */
  static calculateRealizedExpenses(
    budgetLines: FinancialItemWithId[],
    transactions: TransactionWithBudgetLineId[] = [],
  ): number {
    let total = 0;

    // Pour chaque prévision cochée de type expense/saving, utiliser max(enveloppe, consommé)
    budgetLines.forEach((line) => {
      if (
        line.checkedAt != null &&
        (line.kind === 'expense' || line.kind === 'saving')
      ) {
        // Ignorer les lignes virtuelles de rollover
        if (line.id.startsWith('rollover-')) return;

        // Calculer le montant consommé par les transactions cochées allouées
        const consumed = transactions
          .filter(
            (tx) =>
              tx.budgetLineId === line.id &&
              tx.checkedAt != null &&
              (tx.kind === 'expense' || tx.kind === 'saving'),
          )
          .reduce((sum, tx) => sum + tx.amount, 0);

        const effectiveAmount = Math.max(line.amount, consumed);
        total += effectiveAmount;
      }
    });

    // Ajouter les transactions libres (sans budgetLineId) qui sont cochées
    transactions.forEach((tx) => {
      if (
        !tx.budgetLineId &&
        tx.checkedAt != null &&
        (tx.kind === 'expense' || tx.kind === 'saving')
      ) {
        total += tx.amount;
      }
    });

    return total;
  }

  /**
   * Calcule le solde réalisé (basé uniquement sur les éléments cochés)
   * Formule: solde_réalisé = Σ(revenus cochés) - Σ(dépenses + épargnes cochées)
   *
   * @param budgetLines - Lignes budgétaires planifiées
   * @param transactions - Transactions réelles
   * @returns Solde calculé depuis les éléments cochés uniquement
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
  static calculateAllMetricsWithEnvelopes(
    budgetLines: FinancialItemWithId[],
    transactions: TransactionWithBudgetLineId[] = [],
    rollover: number = 0,
  ) {
    const totalIncome = this.calculateTotalIncome(budgetLines, transactions);
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
    metrics: ReturnType<typeof BudgetFormulas.calculateAllMetricsWithEnvelopes>,
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
