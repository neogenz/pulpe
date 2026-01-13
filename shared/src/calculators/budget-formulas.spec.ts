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
 * Helper pour créer des items financiers de test (sans id)
 */
function createFinancialItem(kind: TransactionKind, amount: number) {
  return { kind, amount };
}

let idCounter = 0;

/**
 * Helper pour créer des items financiers avec id (pour calculateAllMetricsWithEnvelopes)
 */
function createFinancialItemWithId(kind: TransactionKind, amount: number) {
  return { id: `item-${++idCounter}`, kind, amount };
}

/**
 * Dataset de test complexe simulant un mois réel (avec ids pour envelope-aware)
 */
const complexTestDataWithIds = {
  budgetLines: [
    createFinancialItemWithId('income', 5000), // Salaire
    createFinancialItemWithId('expense', 1500), // Loyer
    createFinancialItemWithId('expense', 800), // Courses
    createFinancialItemWithId('saving', 500), // Épargne planifiée
  ],
  transactions: [
    { ...createFinancialItem('expense', 200), budgetLineId: null }, // Restaurant (libre)
    { ...createFinancialItem('expense', 150), budgetLineId: null }, // Essence (libre)
    { ...createFinancialItem('income', 300), budgetLineId: null }, // Freelance
    { ...createFinancialItem('saving', 100), budgetLineId: null }, // Épargne supplémentaire
  ],
  rollover: 250, // Report positif
};

/**
 * Dataset de test complexe simulant un mois réel (legacy - sans ids)
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

  describe('calculateRealizedIncome', () => {
    it('should only count checked income items', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'income', amount: 5000, checkedAt: '2025-01-15T10:00:00Z' },
        { kind: 'income', amount: 1000, checkedAt: null },
      ];
      expect(BudgetFormulas.calculateRealizedIncome(budgetLines)).toBe(5000);
    });

    it('should return 0 when no items are checked', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [{ kind: 'income', amount: 5000, checkedAt: null }];
      expect(BudgetFormulas.calculateRealizedIncome(budgetLines)).toBe(0);
    });

    it('should combine checked budget lines and transactions', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'income', amount: 5000, checkedAt: '2025-01-15' },
        { kind: 'income', amount: 1000, checkedAt: null },
      ];
      const transactions: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'income', amount: 300, checkedAt: '2025-01-16' },
        { kind: 'income', amount: 200, checkedAt: null },
      ];
      expect(
        BudgetFormulas.calculateRealizedIncome(budgetLines, transactions),
      ).toBe(5300);
    });

    it('should ignore non-income items', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'expense', amount: 1000, checkedAt: '2025-01-15' },
        { kind: 'saving', amount: 500, checkedAt: '2025-01-15' },
      ];
      expect(BudgetFormulas.calculateRealizedIncome(budgetLines)).toBe(0);
    });

    it('should handle empty arrays', () => {
      expect(BudgetFormulas.calculateRealizedIncome([], [])).toBe(0);
    });
  });

  describe('calculateRealizedExpenses', () => {
    it('should only count checked expense and saving items', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'expense', amount: 1000, checkedAt: '2025-01-15' },
        { kind: 'saving', amount: 500, checkedAt: '2025-01-15' },
        { kind: 'expense', amount: 200, checkedAt: null },
      ];
      expect(BudgetFormulas.calculateRealizedExpenses(budgetLines)).toBe(1500);
    });

    it('should return 0 when no items are checked', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'expense', amount: 1000, checkedAt: null },
        { kind: 'saving', amount: 500, checkedAt: null },
      ];
      expect(BudgetFormulas.calculateRealizedExpenses(budgetLines)).toBe(0);
    });

    it('should combine checked budget lines and transactions', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'expense', amount: 1000, checkedAt: '2025-01-15' },
        { kind: 'expense', amount: 500, checkedAt: null },
      ];
      const transactions: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'expense', amount: 200, checkedAt: '2025-01-16' },
        { kind: 'saving', amount: 100, checkedAt: '2025-01-16' },
        { kind: 'expense', amount: 50, checkedAt: null },
      ];
      expect(
        BudgetFormulas.calculateRealizedExpenses(budgetLines, transactions),
      ).toBe(1300);
    });

    it('should ignore income items', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [{ kind: 'income', amount: 5000, checkedAt: '2025-01-15' }];
      expect(BudgetFormulas.calculateRealizedExpenses(budgetLines)).toBe(0);
    });

    it('should handle empty arrays', () => {
      expect(BudgetFormulas.calculateRealizedExpenses([], [])).toBe(0);
    });
  });

  describe('calculateRealizedBalance', () => {
    it('should calculate balance from checked items only', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'income', amount: 5000, checkedAt: '2025-01-15' },
        { kind: 'expense', amount: 2000, checkedAt: '2025-01-16' },
        { kind: 'expense', amount: 1000, checkedAt: null },
      ];
      expect(BudgetFormulas.calculateRealizedBalance(budgetLines)).toBe(3000);
    });

    it('should handle no checked items', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'income', amount: 5000, checkedAt: null },
        { kind: 'expense', amount: 2000, checkedAt: null },
      ];
      expect(BudgetFormulas.calculateRealizedBalance(budgetLines)).toBe(0);
    });

    it('should combine checked budget lines and transactions', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'income', amount: 5000, checkedAt: '2025-01-15' },
        { kind: 'expense', amount: 1500, checkedAt: '2025-01-15' },
        { kind: 'saving', amount: 500, checkedAt: null },
      ];
      const transactions: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'expense', amount: 200, checkedAt: '2025-01-16' },
        { kind: 'income', amount: 300, checkedAt: '2025-01-16' },
        { kind: 'expense', amount: 100, checkedAt: null },
      ];
      expect(
        BudgetFormulas.calculateRealizedBalance(budgetLines, transactions),
      ).toBe(3600);
    });

    it('should handle negative balance', () => {
      const budgetLines: Array<{
        kind: TransactionKind;
        amount: number;
        checkedAt: string | null;
      }> = [
        { kind: 'income', amount: 2000, checkedAt: '2025-01-15' },
        { kind: 'expense', amount: 3000, checkedAt: '2025-01-15' },
      ];
      expect(BudgetFormulas.calculateRealizedBalance(budgetLines)).toBe(-1000);
    });
  });

  describe('validateMetricsCoherence', () => {
    it('should validate coherent metrics', () => {
      const { budgetLines, transactions, rollover } = complexTestDataWithIds;
      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
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
        createFinancialItemWithId('income', 5000),
        createFinancialItemWithId('expense', 4500),
      ];

      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
        budgetLines,
        [],
        0,
      );

      expect(metrics.totalIncome).toBe(5000);
      expect(metrics.totalExpenses).toBe(4500);
      expect(metrics.available).toBe(5000); // 5000 + 0
      expect(metrics.endingBalance).toBe(500); // 5000 - 4500
      expect(metrics.rollover).toBe(0);
    });

    it('should follow SPECS example: Février with rollover', () => {
      // Exemple SPECS: "Février : income=5200 CHF, expenses=4800 CHF, rollover=500 CHF → ending_balance=900 CHF"
      const budgetLines = [
        createFinancialItemWithId('income', 5200),
        createFinancialItemWithId('expense', 4800),
      ];
      const rollover = 500; // Depuis janvier

      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
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
        createFinancialItemWithId('income', 5000),
        createFinancialItemWithId('expense', 3000),
        createFinancialItemWithId('saving', 1000), // Doit être traité comme expense
      ];

      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
        budgetLines,
        [],
        0,
      );

      expect(metrics.totalExpenses).toBe(4000); // 3000 + 1000 (saving inclus)
      expect(metrics.endingBalance).toBe(1000); // 5000 - 4000
    });

    it('should follow SPECS example: Mars with rollover from Février', () => {
      // Exemple SPECS: "Mars : income=5100 CHF, expenses=5200 CHF, rollover=900 CHF → ending_balance=800 CHF"
      const budgetLines = [
        createFinancialItemWithId('income', 5100),
        createFinancialItemWithId('expense', 5200),
      ];
      const rollover = 900; // Depuis février

      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
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
        createFinancialItemWithId('income', 5000),
        createFinancialItemWithId('expense', 5500),
      ];
      const rollover = 800; // Depuis mars

      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
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
          createFinancialItemWithId('income', month.income),
          createFinancialItemWithId('expense', month.expenses),
        ];

        const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
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
      // Créer un gros dataset avec ids
      const largeBudgetLines = Array.from({ length: 1000 }, (_, i) =>
        createFinancialItemWithId(i % 3 === 0 ? 'income' : 'expense', 100),
      );
      const largeTransactions = Array.from({ length: 1000 }, (_, i) => ({
        ...createFinancialItem(i % 2 === 0 ? 'expense' : 'income', 50),
        budgetLineId: null,
      }));

      const start = performance.now();
      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
        largeBudgetLines,
        largeTransactions,
        0,
      );
      const duration = performance.now() - start;

      // Test de performance (< 50ms pour 2000 items avec envelope logic)
      expect(duration).toBeLessThan(50);

      // Validation des résultats
      expect(metrics.totalIncome).toBeGreaterThan(0);
      expect(metrics.totalExpenses).toBeGreaterThan(0);
      expect(BudgetFormulas.validateMetricsCoherence(metrics)).toBe(true);
    });
  });

  describe('calculateTotalExpensesWithEnvelopes', () => {
    function createBudgetLine(
      id: string,
      kind: TransactionKind,
      amount: number,
    ) {
      return { id, kind, amount };
    }

    function createTransaction(
      kind: TransactionKind,
      amount: number,
      budgetLineId?: string | null,
    ) {
      return { kind, amount, budgetLineId };
    }

    describe('Envelope allocation business rules', () => {
      describe('when transaction is allocated within its envelope', () => {
        it('should only count the envelope amount in total expenses', () => {
          const budgetLines = [createBudgetLine('line-1', 'expense', 500)];
          const transactions = [createTransaction('expense', 100, 'line-1')];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            transactions,
          );

          // Envelope is 500, consumed is 100 -> max(500, 100) = 500
          expect(result).toBe(500);
        });

        it('should not double-count the transaction amount', () => {
          // Without envelope logic: 500 (line) + 100 (tx) = 600 (WRONG)
          // With envelope logic: max(500, 100) = 500 (CORRECT)
          const budgetLines = [createBudgetLine('line-1', 'expense', 500)];
          const transactions = [createTransaction('expense', 100, 'line-1')];

          const naiveResult = BudgetFormulas.calculateTotalExpenses(
            budgetLines,
            transactions,
          );
          const envelopeResult =
            BudgetFormulas.calculateTotalExpensesWithEnvelopes(
              budgetLines,
              transactions,
            );

          expect(naiveResult).toBe(600); // Naive double-counts
          expect(envelopeResult).toBe(500); // Envelope-aware is correct
        });
      });

      describe('when transaction exceeds its envelope', () => {
        it('should count the actual consumed amount (overage)', () => {
          const budgetLines = [createBudgetLine('line-1', 'expense', 100)];
          const transactions = [createTransaction('expense', 150, 'line-1')];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            transactions,
          );

          // Envelope is 100, consumed is 150 -> max(100, 150) = 150
          expect(result).toBe(150);
        });

        it('should calculate overage from user scenario (188/100)', () => {
          const budgetLines = [createBudgetLine('line-1', 'expense', 100)];
          const transactions = [createTransaction('expense', 188, 'line-1')];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            transactions,
          );

          // Envelope is 100, consumed is 188 -> max(100, 188) = 188
          expect(result).toBe(188);
        });
      });

      describe('when transaction has no envelope allocation (free)', () => {
        it('should count the full transaction amount directly', () => {
          const budgetLines: ReturnType<typeof createBudgetLine>[] = [];
          const transactions = [createTransaction('expense', 50, null)];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            transactions,
          );

          expect(result).toBe(50);
        });

        it('should add free transactions to envelope totals', () => {
          const budgetLines = [createBudgetLine('line-1', 'expense', 500)];
          const transactions = [
            createTransaction('expense', 100, 'line-1'),
            createTransaction('expense', 75, null), // Free transaction
          ];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            transactions,
          );

          // Envelope: max(500, 100) = 500
          // Free: 75
          // Total: 500 + 75 = 575
          expect(result).toBe(575);
        });
      });

      describe('when multiple transactions are allocated to same envelope', () => {
        it('should sum transactions and compare to envelope once', () => {
          const budgetLines = [createBudgetLine('line-1', 'expense', 500)];
          const transactions = [
            createTransaction('expense', 200, 'line-1'),
            createTransaction('expense', 150, 'line-1'),
          ];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            transactions,
          );

          // Envelope is 500, consumed is 200 + 150 = 350 -> max(500, 350) = 500
          expect(result).toBe(500);
        });

        it('should handle multiple transactions exceeding envelope', () => {
          const budgetLines = [createBudgetLine('line-1', 'expense', 300)];
          const transactions = [
            createTransaction('expense', 200, 'line-1'),
            createTransaction('expense', 250, 'line-1'),
          ];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            transactions,
          );

          // Envelope is 300, consumed is 200 + 250 = 450 -> max(300, 450) = 450
          expect(result).toBe(450);
        });
      });

      describe('with mixed envelope and free transactions', () => {
        it('should apply envelope rules to allocated and direct impact for free', () => {
          const budgetLines = [
            createBudgetLine('line-1', 'expense', 500), // Within envelope
            createBudgetLine('line-2', 'expense', 100), // Exceeded
          ];
          const transactions = [
            createTransaction('expense', 200, 'line-1'), // Allocated within envelope
            createTransaction('expense', 188, 'line-2'), // Allocated exceeds envelope
            createTransaction('expense', 50, null), // Free transaction
          ];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            transactions,
          );

          // line-1: max(500, 200) = 500
          // line-2: max(100, 188) = 188
          // free: 50
          // Total: 500 + 188 + 50 = 738
          expect(result).toBe(738);
        });
      });

      describe('with savings (treated as expense)', () => {
        it('should apply envelope logic to savings budget lines', () => {
          const budgetLines = [createBudgetLine('line-1', 'saving', 500)];
          const transactions = [createTransaction('saving', 100, 'line-1')];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            transactions,
          );

          expect(result).toBe(500);
        });
      });

      describe('with income transactions', () => {
        it('should not count free income transactions', () => {
          const budgetLines = [createBudgetLine('line-1', 'expense', 500)];
          const transactions = [
            createTransaction('expense', 100, 'line-1'),
            createTransaction('income', 300, null), // Free income - should be ignored
          ];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            transactions,
          );

          expect(result).toBe(500);
        });
      });

      describe('edge cases', () => {
        it('should return 0 for empty arrays', () => {
          expect(
            BudgetFormulas.calculateTotalExpensesWithEnvelopes([], []),
          ).toBe(0);
        });

        it('should handle budget lines with no transactions', () => {
          const budgetLines = [
            createBudgetLine('line-1', 'expense', 500),
            createBudgetLine('line-2', 'expense', 300),
          ];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            [],
          );

          expect(result).toBe(800);
        });

        it('should skip rollover budget lines', () => {
          const budgetLines = [
            createBudgetLine('line-1', 'expense', 500),
            createBudgetLine('rollover-previous', 'expense', 100), // Virtual line
          ];

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            [],
          );

          expect(result).toBe(500);
        });

        it('should handle transactions without budgetLineId field', () => {
          const budgetLines = [createBudgetLine('line-1', 'expense', 500)];
          const transactions = [{ kind: 'expense' as const, amount: 50 }]; // No budgetLineId field

          const result = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
            budgetLines,
            transactions,
          );

          // Budget line: 500, free transaction: 50 -> 550
          expect(result).toBe(550);
        });
      });
    });
  });

  describe('calculateAllMetricsWithEnvelopes', () => {
    function createBudgetLine(
      id: string,
      kind: TransactionKind,
      amount: number,
    ) {
      return { id, kind, amount };
    }

    function createTransaction(
      kind: TransactionKind,
      amount: number,
      budgetLineId?: string | null,
    ) {
      return { kind, amount, budgetLineId };
    }

    it('should calculate all metrics with envelope-aware expenses', () => {
      const budgetLines = [
        createBudgetLine('income-1', 'income', 5000),
        createBudgetLine('expense-1', 'expense', 500),
      ];
      const transactions = [createTransaction('expense', 100, 'expense-1')];
      const rollover = 200;

      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
        budgetLines,
        transactions,
        rollover,
      );

      expect(metrics.totalIncome).toBe(5000);
      expect(metrics.totalExpenses).toBe(500); // envelope-aware: max(500, 100) = 500
      expect(metrics.available).toBe(5200); // 5000 + 200
      expect(metrics.endingBalance).toBe(4700); // 5200 - 500
      expect(metrics.remaining).toBe(4700);
      expect(metrics.rollover).toBe(200);
    });

    it('should count overage when transactions exceed envelope', () => {
      const budgetLines = [
        createBudgetLine('income-1', 'income', 3000),
        createBudgetLine('expense-1', 'expense', 200),
      ];
      const transactions = [createTransaction('expense', 300, 'expense-1')];

      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
        budgetLines,
        transactions,
        0,
      );

      expect(metrics.totalExpenses).toBe(300); // max(200, 300) = 300
      expect(metrics.endingBalance).toBe(2700); // 3000 - 300
    });

    it('should add free transactions directly', () => {
      const budgetLines = [
        createBudgetLine('income-1', 'income', 3000),
        createBudgetLine('expense-1', 'expense', 200),
      ];
      const transactions = [
        createTransaction('expense', 100, 'expense-1'),
        createTransaction('expense', 50, null), // free transaction
      ];

      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
        budgetLines,
        transactions,
        0,
      );

      // envelope: max(200, 100) = 200 + free: 50 = 250
      expect(metrics.totalExpenses).toBe(250);
      expect(metrics.endingBalance).toBe(2750);
    });

    it('should produce coherent metrics (validates formulas)', () => {
      const budgetLines = [
        createBudgetLine('income-1', 'income', 5000),
        createBudgetLine('expense-1', 'expense', 1500),
        createBudgetLine('expense-2', 'expense', 800),
        createBudgetLine('saving-1', 'saving', 500),
      ];
      const transactions = [
        createTransaction('expense', 200, 'expense-1'),
        createTransaction('expense', 1000, 'expense-2'), // exceeds envelope
        createTransaction('income', 300, null),
      ];
      const rollover = 250;

      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
        budgetLines,
        transactions,
        rollover,
      );

      // Validate coherence
      expect(metrics.available).toBe(metrics.totalIncome + metrics.rollover);
      expect(metrics.endingBalance).toBe(
        metrics.available - metrics.totalExpenses,
      );
      expect(metrics.remaining).toBe(metrics.endingBalance);
      expect(BudgetFormulas.validateMetricsCoherence(metrics)).toBe(true);
    });

    it('should handle empty data', () => {
      const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
        [],
        [],
        0,
      );

      expect(metrics.totalIncome).toBe(0);
      expect(metrics.totalExpenses).toBe(0);
      expect(metrics.available).toBe(0);
      expect(metrics.endingBalance).toBe(0);
      expect(metrics.remaining).toBe(0);
      expect(metrics.rollover).toBe(0);
    });
  });
});
