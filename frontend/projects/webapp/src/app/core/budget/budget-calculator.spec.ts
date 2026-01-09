import { describe, beforeEach, it, expect } from 'vitest';
import { BudgetCalculator } from './budget-calculator';
import { type Transaction, type BudgetLine } from 'pulpe-shared';

describe('BudgetCalculator', () => {
  let calculator: BudgetCalculator;

  beforeEach(() => {
    calculator = new BudgetCalculator();
  });

  const createTransaction = (
    amount: number,
    name = 'Test Transaction',
    kind: 'income' | 'expense' | 'saving' = 'expense',
    id = `transaction-${amount}-${kind}`,
    budgetLineId: string | null = null,
  ): Transaction => ({
    id,
    amount,
    name,
    kind,
    budgetId: 'test-budget-id',
    budgetLineId,
    transactionDate: new Date().toISOString(),
    category: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    checkedAt: null,
  });

  // Helper function to create mock BudgetLine objects
  const createBudgetLine = (
    amount: number,
    name: string,
    kind: 'income' | 'expense' | 'saving',
    id = `budget-line-${amount}-${kind}-${Math.random()}`,
  ): BudgetLine => ({
    id,
    budgetId: 'test-budget-id',
    templateLineId: 'test-template-id',
    savingsGoalId: null,
    name,
    amount,
    kind,
    recurrence: 'fixed',
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  describe('calculatePlannedIncome', () => {
    it('should calculate planned income correctly', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(8000, 'Monthly Income', 'income'),
        createBudgetLine(200, 'Freelance', 'income'),
        createBudgetLine(2200, 'Housing Costs', 'expense'), // Should be ignored
        createBudgetLine(500, 'Emergency Fund', 'saving'), // Should be ignored
      ];

      // Act
      const plannedIncome = calculator.calculatePlannedIncome(budgetLines);

      // Assert
      expect(plannedIncome).toBe(8200); // 8000 + 200
    });

    it('should return 0 for empty budget lines', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [];

      // Act
      const plannedIncome = calculator.calculatePlannedIncome(budgetLines);

      // Assert
      expect(plannedIncome).toBe(0);
    });

    it('should return 0 when no income lines exist', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(2200, 'Housing Costs', 'expense'),
        createBudgetLine(500, 'Emergency Fund', 'saving'),
      ];

      // Act
      const plannedIncome = calculator.calculatePlannedIncome(budgetLines);

      // Assert
      expect(plannedIncome).toBe(0);
    });
  });

  describe('calculateTotalAvailable', () => {
    it('should calculate total available correctly from budget lines and transactions', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(8000, 'Monthly Income', 'income'),
        createBudgetLine(2200, 'Housing Costs', 'expense'),
        createBudgetLine(450, 'Health Insurance', 'expense'),
      ];
      const transactions: Transaction[] = [
        createTransaction(500, 'Freelance', 'income'),
        createTransaction(100, 'Groceries', 'expense'),
      ];

      // Act
      const available = calculator.calculateTotalAvailable(
        budgetLines,
        transactions,
      );

      // Assert
      expect(available).toBe(8500); // 8000 (income from budget lines) + 500 (income from transactions)
    });

    it('should handle only budget lines without transactions', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(5000, 'Monthly Income', 'income'),
        createBudgetLine(1000, 'Bonus', 'income'),
      ];

      // Act
      const available = calculator.calculateTotalAvailable(budgetLines, []);

      // Assert
      expect(available).toBe(6000); // 5000 + 1000
    });

    it('should return 0 for empty budget lines and transactions', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [];

      // Act
      const available = calculator.calculateTotalAvailable(budgetLines, []);

      // Assert
      expect(available).toBe(0);
    });
  });

  describe('calculateActualTransactionsAmount', () => {
    it('should calculate actual transactions impact on balance correctly', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(30, 'Restaurant', 'expense'),
        createTransaction(50, 'Groceries', 'expense'),
        createTransaction(25, 'Coffee', 'expense'),
        createTransaction(1000, 'Freelance Income', 'income'),
        createTransaction(200, 'Extra Savings', 'saving'),
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      // Income (+1000) - Expenses (-30 -50 -25) - Savings (-200) = +695
      expect(actualTransactions).toBe(695);
    });

    it('should handle negative impact (more spent than received)', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(500, 'Expenses', 'expense'),
        createTransaction(200, 'More expenses', 'expense'),
        createTransaction(100, 'Small income', 'income'),
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      // Income (+100) - Expenses (-500 -200) = -600
      expect(actualTransactions).toBe(-600);
    });

    it('should return 0 for empty transactions', () => {
      // Arrange
      const transactions: Transaction[] = [];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      expect(actualTransactions).toBe(0);
    });

    it('should handle only income transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(1000, 'Salary', 'income'),
        createTransaction(200, 'Bonus', 'income'),
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      expect(actualTransactions).toBe(1200);
    });

    it('should handle only expense transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(100, 'Food', 'expense'),
        createTransaction(50, 'Transport', 'expense'),
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      expect(actualTransactions).toBe(-150);
    });

    it('should handle only saving transactions', () => {
      // Arrange
      const transactions: Transaction[] = [
        createTransaction(200, 'Emergency Fund', 'saving'),
        createTransaction(300, 'House Fund', 'saving'),
      ];

      // Act
      const actualTransactions =
        calculator.calculateActualTransactionsAmount(transactions);

      // Assert
      expect(actualTransactions).toBe(-500);
    });

    describe('with budgetLines (allocated transactions)', () => {
      it('should exclude allocated transactions when within envelope budget', () => {
        // Arrange - Enveloppe de 500 CHF avec 100 CHF de transactions
        const envelopeId = 'envelope-groceries';
        const budgetLines: BudgetLine[] = [
          createBudgetLine(500, 'Courses', 'expense', envelopeId),
        ];
        const transactions: Transaction[] = [
          createTransaction(100, 'Supermarché', 'expense', 'tx-1', envelopeId),
        ];

        // Act
        const impact = calculator.calculateActualTransactionsAmount(
          transactions,
          budgetLines,
        );

        // Assert - Les 100 CHF sont "couverts" par l'enveloppe, pas d'impact
        expect(impact).toBe(0);
      });

      it('should include only overage when allocated transactions exceed envelope', () => {
        // Arrange - Enveloppe de 500 CHF avec 600 CHF de transactions (100 CHF de dépassement)
        const envelopeId = 'envelope-groceries';
        const budgetLines: BudgetLine[] = [
          createBudgetLine(500, 'Courses', 'expense', envelopeId),
        ];
        const transactions: Transaction[] = [
          createTransaction(300, 'Supermarché', 'expense', 'tx-1', envelopeId),
          createTransaction(300, 'Marché', 'expense', 'tx-2', envelopeId),
        ];

        // Act
        const impact = calculator.calculateActualTransactionsAmount(
          transactions,
          budgetLines,
        );

        // Assert - Seul le dépassement de 100 CHF impacte le budget (négatif car expense)
        expect(impact).toBe(-100);
      });

      it('should calculate 88 CHF overage for 100 CHF envelope with 188 CHF consumed', () => {
        // Arrange - Scénario exact utilisateur: Enveloppe 100 CHF, consommation 188 CHF
        const envelopeId = 'envelope-test';
        const budgetLines: BudgetLine[] = [
          createBudgetLine(100, 'Enveloppe Test', 'expense', envelopeId),
        ];
        const transactions: Transaction[] = [
          createTransaction(
            188,
            'test_feature_dev_1',
            'expense',
            'tx-1',
            envelopeId,
          ),
        ];

        // Act
        const impact = calculator.calculateActualTransactionsAmount(
          transactions,
          budgetLines,
        );

        // Assert - Dépassement de 88 CHF (188 - 100) devrait impacter le budget (négatif car expense)
        expect(impact).toBe(-88);
      });

      it('should calculate remaining correctly with overage (simulating BudgetFinancialOverview)', () => {
        // Arrange - Scénario complet: simule le calcul de budget-financial-overview.ts
        const envelopeId = 'envelope-test';
        const budgetLines: BudgetLine[] = [
          createBudgetLine(1000, 'Salaire', 'income'),
          createBudgetLine(100, 'Enveloppe Test', 'expense', envelopeId),
        ];
        const transactions: Transaction[] = [
          createTransaction(
            188,
            'test_feature_dev_1',
            'expense',
            'tx-1',
            envelopeId,
          ),
        ];

        // Act - Simule exactement le calcul de budget-financial-overview.ts
        const income = calculator.calculatePlannedIncome(budgetLines);
        let expenses = 0;
        let savings = 0;
        budgetLines.forEach((line) => {
          if (line.kind === 'expense') expenses += line.amount;
          if (line.kind === 'saving') savings += line.amount;
        });
        const initialLivingAllowance = income - expenses - savings;
        const transactionImpact = calculator.calculateActualTransactionsAmount(
          transactions,
          budgetLines,
        );
        const remaining = initialLivingAllowance + transactionImpact;

        // Assert
        expect(income).toBe(1000);
        expect(expenses).toBe(100);
        expect(savings).toBe(0);
        expect(initialLivingAllowance).toBe(900); // 1000 - 100 - 0
        expect(transactionImpact).toBe(-88); // Dépassement de 88 CHF
        expect(remaining).toBe(812); // 900 - 88 = 812 (diminution de 88 CHF par rapport à 900)
      });

      it('should handle free transactions normally while excluding allocated ones', () => {
        // Arrange - Mix de transactions libres et allouées
        const envelopeId = 'envelope-groceries';
        const budgetLines: BudgetLine[] = [
          createBudgetLine(500, 'Courses', 'expense', envelopeId),
        ];
        const transactions: Transaction[] = [
          // Transaction allouée sans dépassement → impact 0
          createTransaction(200, 'Supermarché', 'expense', 'tx-1', envelopeId),
          // Transactions libres → impact normal
          createTransaction(50, 'Restaurant', 'expense', 'tx-2', null),
          createTransaction(100, 'Freelance', 'income', 'tx-3', null),
        ];

        // Act
        const impact = calculator.calculateActualTransactionsAmount(
          transactions,
          budgetLines,
        );

        // Assert - Seulement les transactions libres comptent: +100 - 50 = 50
        expect(impact).toBe(50);
      });

      it('should handle multiple envelopes with different allocation levels', () => {
        // Arrange
        const envelopeGroceries = 'envelope-groceries';
        const envelopeRestaurant = 'envelope-restaurant';
        const budgetLines: BudgetLine[] = [
          createBudgetLine(500, 'Courses', 'expense', envelopeGroceries),
          createBudgetLine(200, 'Restaurant', 'expense', envelopeRestaurant),
        ];
        const transactions: Transaction[] = [
          // Enveloppe courses: 400/500 → pas de dépassement
          createTransaction(
            400,
            'Supermarché',
            'expense',
            'tx-1',
            envelopeGroceries,
          ),
          // Enveloppe restaurant: 350/200 → dépassement de 150
          createTransaction(
            200,
            'Resto 1',
            'expense',
            'tx-2',
            envelopeRestaurant,
          ),
          createTransaction(
            150,
            'Resto 2',
            'expense',
            'tx-3',
            envelopeRestaurant,
          ),
        ];

        // Act
        const impact = calculator.calculateActualTransactionsAmount(
          transactions,
          budgetLines,
        );

        // Assert - Seul le dépassement restaurant de 150 CHF
        expect(impact).toBe(-150);
      });

      it('should handle income envelope overage correctly (positive impact)', () => {
        // Arrange - Enveloppe revenu de 1000 avec 1500 de transactions
        const envelopeId = 'envelope-freelance';
        const budgetLines: BudgetLine[] = [
          createBudgetLine(1000, 'Freelance', 'income', envelopeId),
        ];
        const transactions: Transaction[] = [
          createTransaction(800, 'Client A', 'income', 'tx-1', envelopeId),
          createTransaction(700, 'Client B', 'income', 'tx-2', envelopeId),
        ];

        // Act
        const impact = calculator.calculateActualTransactionsAmount(
          transactions,
          budgetLines,
        );

        // Assert - Dépassement de 500 CHF en revenu (positif)
        expect(impact).toBe(500);
      });

      it('should fallback to legacy behavior when budgetLines is undefined', () => {
        // Arrange - Même scénario que le premier test mais sans budgetLines
        const envelopeId = 'envelope-groceries';
        const transactions: Transaction[] = [
          createTransaction(100, 'Supermarché', 'expense', 'tx-1', envelopeId),
        ];

        // Act - Sans budgetLines, toutes les transactions comptent
        const impact = calculator.calculateActualTransactionsAmount(
          transactions,
          undefined,
        );

        // Assert - Comportement legacy: la transaction compte normalement
        expect(impact).toBe(-100);
      });

      it('should ignore allocated transactions for non-existent budget lines', () => {
        // Arrange - Transaction allouée à une enveloppe qui n'existe pas
        const budgetLines: BudgetLine[] = [
          createBudgetLine(500, 'Courses', 'expense', 'existing-envelope'),
        ];
        const transactions: Transaction[] = [
          createTransaction(
            100,
            'Orphan',
            'expense',
            'tx-1',
            'non-existent-envelope',
          ),
        ];

        // Act
        const impact = calculator.calculateActualTransactionsAmount(
          transactions,
          budgetLines,
        );

        // Assert - Transaction ignorée car son enveloppe n'existe pas (pas de dépassement calculable)
        expect(impact).toBe(0);
      });
    });
  });

  describe('calculateLocalEndingBalance', () => {
    it('should calculate ending balance correctly with income, expenses and transactions', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(8000, 'Salary', 'income'),
        createBudgetLine(2000, 'Rent', 'expense'),
        createBudgetLine(500, 'Insurance', 'expense'),
        createBudgetLine(1000, 'Savings', 'saving'),
      ];
      const transactions: Transaction[] = [
        createTransaction(200, 'Groceries', 'expense'),
        createTransaction(100, 'Restaurant', 'expense'),
        createTransaction(500, 'Freelance', 'income'),
      ];

      // Act
      const endingBalance = calculator.calculateLocalEndingBalance(
        budgetLines,
        transactions,
      );

      // Assert
      // Income: 8000 (budget) + 500 (transaction) = 8500
      // Fixed Block: 2000 + 500 + 1000 = 3500
      // Transaction expenses: 200 + 100 = 300
      // Formula: 8000 - 3500 + (500 - 300) = 4700
      expect(endingBalance).toBe(4700);
    });

    it('should handle case with no transactions', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(5000, 'Salary', 'income'),
        createBudgetLine(2000, 'Rent', 'expense'),
        createBudgetLine(500, 'Savings', 'saving'),
      ];
      const transactions: Transaction[] = [];

      // Act
      const endingBalance = calculator.calculateLocalEndingBalance(
        budgetLines,
        transactions,
      );

      // Assert
      // Income: 5000, Fixed Block: 2500, No transactions
      // Formula: 5000 - 2500 + 0 = 2500
      expect(endingBalance).toBe(2500);
    });

    it('should handle negative ending balance when expenses exceed income', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(3000, 'Salary', 'income'),
        createBudgetLine(4000, 'Rent', 'expense'),
        createBudgetLine(500, 'Savings', 'saving'),
      ];
      const transactions: Transaction[] = [
        createTransaction(300, 'Groceries', 'expense'),
      ];

      // Act
      const endingBalance = calculator.calculateLocalEndingBalance(
        budgetLines,
        transactions,
      );

      // Assert
      // Income: 3000, Fixed Block: 4500, Transaction expenses: 300
      // Formula: 3000 - 4500 + (-300) = -1800
      expect(endingBalance).toBe(-1800);
    });

    it('should handle transactions that increase the balance', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(4000, 'Salary', 'income'),
        createBudgetLine(3000, 'Expenses', 'expense'),
      ];
      const transactions: Transaction[] = [
        createTransaction(1000, 'Bonus', 'income'),
        createTransaction(200, 'Extra expense', 'expense'),
      ];

      // Act
      const endingBalance = calculator.calculateLocalEndingBalance(
        budgetLines,
        transactions,
      );

      // Assert
      // Income: 4000, Fixed Block: 3000
      // Transaction impact: +1000 - 200 = +800
      // Formula: 4000 - 3000 + 800 = 1800
      expect(endingBalance).toBe(1800);
    });

    it('should handle empty budget lines with transactions', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [];
      const transactions: Transaction[] = [
        createTransaction(1000, 'Income', 'income'),
        createTransaction(300, 'Expense', 'expense'),
      ];

      // Act
      const endingBalance = calculator.calculateLocalEndingBalance(
        budgetLines,
        transactions,
      );

      // Assert
      // No budget lines, only transactions: 1000 - 300 = 700
      expect(endingBalance).toBe(700);
    });

    it('should correctly handle all transaction types', () => {
      // Arrange
      const budgetLines: BudgetLine[] = [
        createBudgetLine(6000, 'Salary', 'income'),
        createBudgetLine(2000, 'Rent', 'expense'),
      ];
      const transactions: Transaction[] = [
        createTransaction(500, 'Freelance', 'income'),
        createTransaction(300, 'Groceries', 'expense'),
        createTransaction(200, 'Emergency Fund', 'saving'),
      ];

      // Act
      const endingBalance = calculator.calculateLocalEndingBalance(
        budgetLines,
        transactions,
      );

      // Assert
      // Income: 6000, Fixed Block: 2000
      // Transaction impact: +500 - 300 - 200 = 0
      // Formula: 6000 - 2000 + 0 = 4000
      expect(endingBalance).toBe(4000);
    });

    it('should match the business formula: Income - (Expenses + Savings)', () => {
      // Arrange - Scenario from SPECS.md
      const budgetLines: BudgetLine[] = [
        createBudgetLine(5000, 'Income', 'income'),
        createBudgetLine(4500, 'Total Expenses', 'expense'),
      ];
      const transactions: Transaction[] = [];

      // Act
      const endingBalance = calculator.calculateLocalEndingBalance(
        budgetLines,
        transactions,
      );

      // Assert
      // According to SPECS: ending_balance = 500 (for January example)
      expect(endingBalance).toBe(500);
    });
  });

  describe('enrichWithCumulativeBalance', () => {
    it('should calculate cumulative balance correctly for mixed transactions', () => {
      // Arrange
      const items = [
        { id: '1', kind: 'income' as const, amount: 5000, name: 'Salary' },
        {
          id: '2',
          kind: 'saving' as const,
          amount: 1000,
          name: 'Emergency Fund',
        },
        { id: '3', kind: 'expense' as const, amount: 2000, name: 'Rent' },
        { id: '4', kind: 'income' as const, amount: 500, name: 'Bonus' },
        { id: '5', kind: 'expense' as const, amount: 300, name: 'Groceries' },
      ];

      // Act
      const result = calculator.enrichWithCumulativeBalance(items);

      // Assert
      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        id: '1',
        kind: 'income',
        amount: 5000,
        name: 'Salary',
        cumulativeBalance: 5000,
      });
      expect(result[1]).toEqual({
        id: '2',
        kind: 'saving',
        amount: 1000,
        name: 'Emergency Fund',
        cumulativeBalance: 4000,
      });
      expect(result[2]).toEqual({
        id: '3',
        kind: 'expense',
        amount: 2000,
        name: 'Rent',
        cumulativeBalance: 2000,
      });
      expect(result[3]).toEqual({
        id: '4',
        kind: 'income',
        amount: 500,
        name: 'Bonus',
        cumulativeBalance: 2500,
      });
      expect(result[4]).toEqual({
        id: '5',
        kind: 'expense',
        amount: 300,
        name: 'Groceries',
        cumulativeBalance: 2200,
      });
    });

    it('should handle empty array', () => {
      // Arrange
      const items: {
        kind: 'income' | 'expense' | 'saving';
        amount: number;
      }[] = [];

      // Act
      const result = calculator.enrichWithCumulativeBalance(items);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle only income items', () => {
      // Arrange
      const items = [
        { id: '1', kind: 'income' as const, amount: 1000, name: 'Salary' },
        { id: '2', kind: 'income' as const, amount: 500, name: 'Bonus' },
      ];

      // Act
      const result = calculator.enrichWithCumulativeBalance(items);

      // Assert
      expect(result[0].cumulativeBalance).toBe(1000);
      expect(result[1].cumulativeBalance).toBe(1500);
    });

    it('should handle only expense items', () => {
      // Arrange
      const items = [
        { id: '1', kind: 'expense' as const, amount: 200, name: 'Food' },
        { id: '2', kind: 'expense' as const, amount: 300, name: 'Transport' },
      ];

      // Act
      const result = calculator.enrichWithCumulativeBalance(items);

      // Assert
      expect(result[0].cumulativeBalance).toBe(-200);
      expect(result[1].cumulativeBalance).toBe(-500);
    });

    it('should preserve all original item properties', () => {
      // Arrange
      const items = [
        {
          id: 'test-1',
          kind: 'income' as const,
          amount: 1000,
          name: 'Test',
          customProp: 'custom',
        },
      ];

      // Act
      const result = calculator.enrichWithCumulativeBalance(items);

      // Assert
      expect(result[0]).toEqual({
        id: 'test-1',
        kind: 'income',
        amount: 1000,
        name: 'Test',
        customProp: 'custom',
        cumulativeBalance: 1000,
      });
    });
  });
});
