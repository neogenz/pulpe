import { Injectable } from '@angular/core';
import {
  type Transaction,
  type BudgetLine,
  type TransactionKind,
  BudgetFormulas,
} from 'pulpe-shared';

@Injectable({ providedIn: 'root' })
export class BudgetCalculator {
  /**
   * Calcule le revenu planifié depuis les budget lines
   * Délègue au shared BudgetFormulas
   */
  calculatePlannedIncome(budgetLines: BudgetLine[]): number {
    return BudgetFormulas.calculateTotalIncome(budgetLines, []);
  }

  /**
   * Calcule l'impact des transactions réelles sur la balance
   *
   * Règle métier importante:
   * - Les transactions LIBRES (budgetLineId = null) impactent directement le budget
   * - Les transactions ALLOUÉES (budgetLineId != null) sont déjà "couvertes" par leur enveloppe
   *   → Elles n'impactent le budget que si elles causent un DÉPASSEMENT
   *   → Dans ce cas, seul le dépassement est compté
   *
   * @param transactions Les transactions à calculer
   * @param budgetLines Les lignes budgétaires (optionnel - si fourni, calcule les dépassements)
   */
  calculateActualTransactionsAmount(
    transactions: Transaction[],
    budgetLines?: BudgetLine[],
  ): number {
    // Si pas de budgetLines fourni, comportement legacy (toutes les transactions comptent)
    if (!budgetLines) {
      return transactions.reduce(
        (total, tx) => total + this.#getSignedAmount(tx.kind, tx.amount),
        0,
      );
    }

    // Séparer les transactions libres et allouées
    const freeTransactions = transactions.filter((tx) => !tx.budgetLineId);
    const allocatedTransactions = transactions.filter((tx) => tx.budgetLineId);

    // Impact des transactions libres (comportement normal)
    const freeImpact = freeTransactions.reduce(
      (total, tx) => total + this.#getSignedAmount(tx.kind, tx.amount),
      0,
    );

    // Calculer le dépassement par enveloppe
    const overageImpact = this.#calculateOverageImpact(
      allocatedTransactions,
      budgetLines,
    );

    return freeImpact + overageImpact;
  }

  /**
   * Calcule l'impact des dépassements d'enveloppes
   * Pour chaque enveloppe: si consumed > amount, le dépassement impacte le budget
   */
  #calculateOverageImpact(
    allocatedTransactions: Transaction[],
    budgetLines: BudgetLine[],
  ): number {
    // Grouper les transactions par budgetLineId
    const transactionsByLine = new Map<string, Transaction[]>();
    for (const tx of allocatedTransactions) {
      if (!tx.budgetLineId) continue;
      const existing = transactionsByLine.get(tx.budgetLineId) ?? [];
      existing.push(tx);
      transactionsByLine.set(tx.budgetLineId, existing);
    }

    let totalOverage = 0;

    // Pour chaque enveloppe avec des transactions allouées
    for (const [lineId, lineTxs] of transactionsByLine) {
      const budgetLine = budgetLines.find((bl) => bl.id === lineId);
      if (!budgetLine) continue;

      // Calculer la consommation totale de cette enveloppe
      const consumed = lineTxs.reduce((sum, tx) => sum + tx.amount, 0);

      // Si dépassement, l'ajouter à l'impact (avec le signe approprié)
      if (consumed > budgetLine.amount) {
        const overage = consumed - budgetLine.amount;
        // Le dépassement est une dépense supplémentaire (signe négatif)
        totalOverage += this.#getSignedAmount(budgetLine.kind, overage);
      }
    }

    return totalOverage;
  }

  calculateTotalAvailable(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
    rollover = 0,
  ): number {
    const totalIncome = BudgetFormulas.calculateTotalIncome(
      budgetLines,
      transactions,
    );
    return BudgetFormulas.calculateAvailable(totalIncome, rollover);
  }

  /**
   * Enrichit les items avec leur balance cumulative de manière immutable
   * Logique métier pure : traite chaque item et calcule le cumul
   */
  enrichWithCumulativeBalance<
    T extends { kind: TransactionKind; amount: number },
  >(items: T[]): (T & { cumulativeBalance: number })[] {
    let runningBalance = 0;
    return items.map((item) => {
      const signedAmount = this.#getSignedAmount(item.kind, item.amount);
      runningBalance += signedAmount;
      return {
        ...item,
        cumulativeBalance: runningBalance,
      };
    });
  }

  /**
   * Calcule le ending balance localement selon les spécifications métier
   * ending_balance = available - totalExpenses (avec logique d'enveloppe)
   * Délègue au shared BudgetFormulas
   *
   * @param budgetLines Les lignes budgétaires planifiées
   * @param transactions Les transactions réelles effectuées
   * @param rollover Le rollover du mois précédent
   * @returns Le ending balance calculé localement
   */
  calculateLocalEndingBalance(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
    rollover = 0,
  ): number {
    return BudgetFormulas.calculateAllMetricsWithEnvelopes(
      budgetLines,
      transactions,
      rollover,
    ).endingBalance;
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
