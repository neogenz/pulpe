/**
 * BUDGET FORMULAS TESTS - Tests exhaustifs des calculs métier
 *
 * Validation des formules SPECS.md section 3 "Modèle de Calcul"
 * Tests appliqués côté frontend ET backend
 */

import { describe, it, expect } from 'vitest';
import { BudgetFormulas } from './budget-formulas.js';
import type { TransactionKind } from '../types.js';

/**
 * Helper pour créer des items financiers de test
 */
function createFinancialItem(kind: TransactionKind, amount: number) {
  return { kind, amount };
}

/**
 * Dataset de test complexe simulant un mois réel
 */
const complexTestData = {
  budgetLines: [
    createFinancialItem('income', 5000), // Salaire
    createFinancialItem('expense', 1500), // Loyer
    createFinancialItem('expense', 800), // Courses
    createFinancialItem('saving', 500), // Épargne planifiée
  ],
  transactions: [
    createFinancialItem('expense', 200), // Restaurant
    createFinancialItem('expense', 150), // Essence
    createFinancialItem('income', 300), // Freelance
    createFinancialItem('saving', 100), // Épargne supplémentaire
  ],
  rollover: 250, // Report positif
};

describe('BudgetFormulas', () => {
  describe('calculateTotalIncome', () => {
    it('should calculate income from budget lines only', () => {
      const budgetLines = [
        createFinancialItem('income', 5000),
        createFinancialItem('income', 1000),
        createFinancialItem('expense', 500), // Should be ignored
      ];

      expect(BudgetFormulas.calculateTotalIncome(budgetLines, [])).toBe(6000);
    });

    it('should calculate income from budget lines and transactions', () => {
      const budgetLines = [createFinancialItem('income', 5000)];
      const transactions = [createFinancialItem('income', 300)];

      expect(
        BudgetFormulas.calculateTotalIncome(budgetLines, transactions),
      ).toBe(5300);
    });

    it('should handle empty arrays', () => {
      expect(BudgetFormulas.calculateTotalIncome([], [])).toBe(0);
      expect(BudgetFormulas.calculateTotalIncome([])).toBe(0);
    });

    it('should ignore non-income items', () => {
      const budgetLines = [
        createFinancialItem('expense', 1000),
        createFinancialItem('saving', 500),
      ];
      const transactions = [createFinancialItem('expense', 200)];

      expect(
        BudgetFormulas.calculateTotalIncome(budgetLines, transactions),
      ).toBe(0);
    });
  });

  describe('calculateTotalExpenses', () => {
    it('should include both expenses and savings according to SPECS', () => {
      const budgetLines = [
        createFinancialItem('expense', 1000),
        createFinancialItem('saving', 500), // Traité comme expense selon SPECS
        createFinancialItem('income', 5000), // Should be ignored
      ];

      expect(BudgetFormulas.calculateTotalExpenses(budgetLines, [])).toBe(1500);
    });

    it('should combine budget lines and transactions expenses', () => {
      const budgetLines = [
        createFinancialItem('expense', 1000),
        createFinancialItem('saving', 500),
      ];
      const transactions = [
        createFinancialItem('expense', 200),
        createFinancialItem('saving', 100),
      ];

      expect(
        BudgetFormulas.calculateTotalExpenses(budgetLines, transactions),
      ).toBe(1800);
    });

    it('should handle empty arrays', () => {
      expect(BudgetFormulas.calculateTotalExpenses([], [])).toBe(0);
      expect(BudgetFormulas.calculateTotalExpenses([])).toBe(0);
    });

    it('should ignore income items', () => {
      const budgetLines = [createFinancialItem('income', 5000)];
      const transactions = [createFinancialItem('income', 300)];

      expect(
        BudgetFormulas.calculateTotalExpenses(budgetLines, transactions),
      ).toBe(0);
    });
  });

  describe('calculateAvailable', () => {
    it('should implement SPECS formula: available = income + rollover', () => {
      expect(BudgetFormulas.calculateAvailable(5000, 500)).toBe(5500);
      expect(BudgetFormulas.calculateAvailable(5000, -200)).toBe(4800);
      expect(BudgetFormulas.calculateAvailable(5000, 0)).toBe(5000);
    });

    it('should handle edge cases', () => {
      expect(BudgetFormulas.calculateAvailable(0, 1000)).toBe(1000);
      expect(BudgetFormulas.calculateAvailable(5000, -5000)).toBe(0);
      expect(BudgetFormulas.calculateAvailable(0, 0)).toBe(0);
    });
  });

  describe('calculateEndingBalance', () => {
    it('should implement SPECS formula: ending_balance = available - expenses', () => {
      expect(BudgetFormulas.calculateEndingBalance(5500, 4000)).toBe(1500);
      expect(BudgetFormulas.calculateEndingBalance(5000, 5500)).toBe(-500); // Dépassement autorisé
    });

    it('should handle edge cases', () => {
      expect(BudgetFormulas.calculateEndingBalance(0, 0)).toBe(0);
      expect(BudgetFormulas.calculateEndingBalance(1000, 0)).toBe(1000);
      expect(BudgetFormulas.calculateEndingBalance(0, 1000)).toBe(-1000);
    });
  });

  describe('calculateRemaining', () => {
    it('should be identical to ending balance per SPECS', () => {
      const available = 5500;
      const expenses = 4000;

      const endingBalance = BudgetFormulas.calculateEndingBalance(
        available,
        expenses,
      );
      const remaining = BudgetFormulas.calculateRemaining(available, expenses);

      expect(remaining).toBe(endingBalance);
      expect(remaining).toBe(1500);
    });
  });

  describe('calculateAllMetrics', () => {
    it('should calculate all metrics coherently with complex data', () => {
      const { budgetLines, transactions, rollover } = complexTestData;

      const metrics = BudgetFormulas.calculateAllMetrics(
        budgetLines,
        transactions,
        rollover,
      );

      // Vérifications individuelles
      expect(metrics.totalIncome).toBe(5300); // 5000 + 300
      expect(metrics.totalExpenses).toBe(3250); // 1500 + 800 + 500 + 200 + 150 + 100
      expect(metrics.available).toBe(5550); // 5300 + 250
      expect(metrics.endingBalance).toBe(2300); // 5550 - 3250
      expect(metrics.remaining).toBe(2300); // Same as ending balance
      expect(metrics.rollover).toBe(250);
    });

    it('should handle simple case', () => {
      const budgetLines = [
        createFinancialItem('income', 5000),
        createFinancialItem('expense', 2000),
      ];

      const metrics = BudgetFormulas.calculateAllMetrics(budgetLines, [], 0);

      expect(metrics.totalIncome).toBe(5000);
      expect(metrics.totalExpenses).toBe(2000);
      expect(metrics.available).toBe(5000);
      expect(metrics.endingBalance).toBe(3000);
      expect(metrics.remaining).toBe(3000);
      expect(metrics.rollover).toBe(0);
    });

    it('should handle deficit scenario', () => {
      const budgetLines = [
        createFinancialItem('income', 3000),
        createFinancialItem('expense', 4000),
      ];
      const rollover = -500; // Déficit précédent

      const metrics = BudgetFormulas.calculateAllMetrics(
        budgetLines,
        [],
        rollover,
      );

      expect(metrics.totalIncome).toBe(3000);
      expect(metrics.totalExpenses).toBe(4000);
      expect(metrics.available).toBe(2500); // 3000 - 500
      expect(metrics.endingBalance).toBe(-1500); // 2500 - 4000 (déficit)
      expect(metrics.remaining).toBe(-1500);
      expect(metrics.rollover).toBe(-500);
    });
  });

  describe('validateMetricsCoherence', () => {
    it('should validate coherent metrics', () => {
      const { budgetLines, transactions, rollover } = complexTestData;
      const metrics = BudgetFormulas.calculateAllMetrics(
        budgetLines,
        transactions,
        rollover,
      );

      expect(BudgetFormulas.validateMetricsCoherence(metrics)).toBe(true);
    });

    it('should detect incoherent metrics', () => {
      // Métriques incorrectes construites manuellement
      const badMetrics = {
        totalIncome: 5000,
        totalExpenses: 3000,
        available: 4000, // Incorrecte: devrait être 5000 + rollover
        endingBalance: 2000,
        remaining: 2000,
        rollover: 0,
      };

      expect(BudgetFormulas.validateMetricsCoherence(badMetrics)).toBe(false);
    });

    it('should reject negative income or expenses', () => {
      const badMetrics = {
        totalIncome: -1000, // Invalide
        totalExpenses: 3000,
        available: 4000,
        endingBalance: 2000,
        remaining: 2000,
        rollover: 0,
      };

      expect(BudgetFormulas.validateMetricsCoherence(badMetrics)).toBe(false);
    });
  });

  describe('SPECS Compliance Tests', () => {
    it('should follow SPECS example: Janvier calculation', () => {
      // Exemple SPECS: "Janvier : income=5000 CHF, expenses=4500 CHF, rollover=0 → ending_balance=500 CHF"
      const budgetLines = [
        createFinancialItem('income', 5000),
        createFinancialItem('expense', 4500),
      ];

      const metrics = BudgetFormulas.calculateAllMetrics(budgetLines, [], 0);

      expect(metrics.totalIncome).toBe(5000);
      expect(metrics.totalExpenses).toBe(4500);
      expect(metrics.available).toBe(5000); // 5000 + 0
      expect(metrics.endingBalance).toBe(500); // 5000 - 4500
      expect(metrics.rollover).toBe(0);
    });

    it('should follow SPECS example: Février with rollover', () => {
      // Exemple SPECS: "Février : income=5200 CHF, expenses=4800 CHF, rollover=500 CHF → ending_balance=900 CHF"
      const budgetLines = [
        createFinancialItem('income', 5200),
        createFinancialItem('expense', 4800),
      ];
      const rollover = 500; // Depuis janvier

      const metrics = BudgetFormulas.calculateAllMetrics(
        budgetLines,
        [],
        rollover,
      );

      expect(metrics.totalIncome).toBe(5200);
      expect(metrics.totalExpenses).toBe(4800);
      expect(metrics.available).toBe(5700); // 5200 + 500
      expect(metrics.endingBalance).toBe(900); // 5700 - 4800
      expect(metrics.rollover).toBe(500);
    });

    it('should handle SPECS savings as expenses', () => {
      // Vérification SPECS: "Le saving est volontairement traité comme une expense"
      const budgetLines = [
        createFinancialItem('income', 5000),
        createFinancialItem('expense', 3000),
        createFinancialItem('saving', 1000), // Doit être traité comme expense
      ];

      const metrics = BudgetFormulas.calculateAllMetrics(budgetLines, [], 0);

      expect(metrics.totalExpenses).toBe(4000); // 3000 + 1000 (saving inclus)
      expect(metrics.endingBalance).toBe(1000); // 5000 - 4000
    });

    it('should follow SPECS example: Mars with rollover from Février', () => {
      // Exemple SPECS: "Mars : income=5100 CHF, expenses=5200 CHF, rollover=900 CHF → ending_balance=800 CHF"
      const budgetLines = [
        createFinancialItem('income', 5100),
        createFinancialItem('expense', 5200),
      ];
      const rollover = 900; // Depuis février

      const metrics = BudgetFormulas.calculateAllMetrics(
        budgetLines,
        [],
        rollover,
      );

      expect(metrics.totalIncome).toBe(5100);
      expect(metrics.totalExpenses).toBe(5200);
      expect(metrics.available).toBe(6000); // 5100 + 900
      expect(metrics.endingBalance).toBe(800); // 6000 - 5200
      expect(metrics.rollover).toBe(900);
    });

    it('should follow SPECS example: Avril with rollover from Mars', () => {
      // Exemple SPECS: "Avril : income=5000 CHF, expenses=5500 CHF, rollover=800 CHF → ending_balance=300 CHF"
      const budgetLines = [
        createFinancialItem('income', 5000),
        createFinancialItem('expense', 5500),
      ];
      const rollover = 800; // Depuis mars

      const metrics = BudgetFormulas.calculateAllMetrics(
        budgetLines,
        [],
        rollover,
      );

      expect(metrics.totalIncome).toBe(5000);
      expect(metrics.totalExpenses).toBe(5500);
      expect(metrics.available).toBe(5800); // 5000 + 800
      expect(metrics.endingBalance).toBe(300); // 5800 - 5500
      expect(metrics.rollover).toBe(800);
    });

    it('should validate complete SPECS chaining example (January to April)', () => {
      // Test complet du chaînage sur 4 mois selon SPECS lignes 93-98
      const months = [
        {
          name: 'Janvier',
          income: 5000,
          expenses: 4500,
          rollover: 0,
          expectedEndingBalance: 500,
        },
        {
          name: 'Février',
          income: 5200,
          expenses: 4800,
          rollover: 500,
          expectedEndingBalance: 900,
        },
        {
          name: 'Mars',
          income: 5100,
          expenses: 5200,
          rollover: 900,
          expectedEndingBalance: 800,
        },
        {
          name: 'Avril',
          income: 5000,
          expenses: 5500,
          rollover: 800,
          expectedEndingBalance: 300,
        },
      ];

      months.forEach((month, index) => {
        const budgetLines = [
          createFinancialItem('income', month.income),
          createFinancialItem('expense', month.expenses),
        ];

        const metrics = BudgetFormulas.calculateAllMetrics(
          budgetLines,
          [],
          month.rollover,
        );

        // Vérifier que le ending_balance correspond exactement aux SPECS
        expect(metrics.endingBalance).toBe(month.expectedEndingBalance);

        // Vérifier le chaînage: ending_balance de ce mois = rollover du mois suivant
        if (index < months.length - 1) {
          expect(metrics.endingBalance).toBe(months[index + 1].rollover);
        }
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', () => {
      // Créer un gros dataset
      const largeBudgetLines = Array.from({ length: 1000 }, (_, i) =>
        createFinancialItem(i % 3 === 0 ? 'income' : 'expense', 100),
      );
      const largeTransactions = Array.from({ length: 1000 }, (_, i) =>
        createFinancialItem(i % 2 === 0 ? 'expense' : 'income', 50),
      );

      const start = performance.now();
      const metrics = BudgetFormulas.calculateAllMetrics(
        largeBudgetLines,
        largeTransactions,
        0,
      );
      const duration = performance.now() - start;

      // Test de performance (< 10ms pour 2000 items)
      expect(duration).toBeLessThan(10);

      // Validation des résultats
      expect(metrics.totalIncome).toBeGreaterThan(0);
      expect(metrics.totalExpenses).toBeGreaterThan(0);
      expect(BudgetFormulas.validateMetricsCoherence(metrics)).toBe(true);
    });
  });
});
