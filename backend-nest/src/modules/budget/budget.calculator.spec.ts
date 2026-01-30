import { describe, it, expect } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { BudgetCalculator } from './budget.calculator';
import { BudgetRepository } from './budget.repository';
import { EncryptionService } from '@modules/encryption/encryption.service';
import { createMockPinoLogger } from '../../test/test-mocks';

describe('BudgetCalculator', () => {
  describe('calculateEndingBalance', () => {
    it('should calculate ending balance with envelope-aware expense logic', async () => {
      // ARRANGE
      const mockRepository = {
        fetchBudgetData: () =>
          Promise.resolve({
            budgetLines: [
              { id: 'line-1', kind: 'income', amount: 5000 },
              { id: 'line-2', kind: 'expense', amount: 500 },
            ],
            transactions: [
              {
                id: 'tx-1',
                kind: 'expense',
                amount: 100,
                budget_line_id: 'line-2',
              },
            ],
          }),
      };

      const mockEncryptionService = {
        ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
        encryptAmount: () => 'encrypted-mock',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BudgetCalculator,
          {
            provide: `INFO_LOGGER:${BudgetCalculator.name}`,
            useValue: createMockPinoLogger(),
          },
          {
            provide: BudgetRepository,
            useValue: mockRepository,
          },
          {
            provide: EncryptionService,
            useValue: mockEncryptionService,
          },
        ],
      }).compile();

      const calculator = module.get<BudgetCalculator>(BudgetCalculator);

      // ACT
      const result = await calculator.calculateEndingBalance(
        'budget-id',
        {} as any,
      );

      // ASSERT
      // Income: 5000
      // Expenses: max(500, 100) = 500 (envelope covers the transaction)
      // Ending balance = 5000 - 500 = 4500
      expect(result).toBe(4500);
    });

    it('should count overage when transaction exceeds envelope', async () => {
      // ARRANGE
      const mockRepository = {
        fetchBudgetData: () =>
          Promise.resolve({
            budgetLines: [
              { id: 'line-1', kind: 'income', amount: 5000 },
              { id: 'line-2', kind: 'expense', amount: 100 },
            ],
            transactions: [
              {
                id: 'tx-1',
                kind: 'expense',
                amount: 150,
                budget_line_id: 'line-2',
              },
            ],
          }),
      };

      const mockEncryptionService = {
        ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
        encryptAmount: () => 'encrypted-mock',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BudgetCalculator,
          {
            provide: `INFO_LOGGER:${BudgetCalculator.name}`,
            useValue: createMockPinoLogger(),
          },
          {
            provide: BudgetRepository,
            useValue: mockRepository,
          },
          {
            provide: EncryptionService,
            useValue: mockEncryptionService,
          },
        ],
      }).compile();

      const calculator = module.get<BudgetCalculator>(BudgetCalculator);

      // ACT
      const result = await calculator.calculateEndingBalance(
        'budget-id',
        {} as any,
      );

      // ASSERT
      // Income: 5000
      // Expenses: max(100, 150) = 150 (overage counted)
      // Ending balance = 5000 - 150 = 4850
      expect(result).toBe(4850);
    });

    it('should pass correct field options to repository', async () => {
      // ARRANGE
      interface BudgetDataOptions {
        budgetLineFields?: string;
        transactionFields?: string;
      }
      let capturedOptions: BudgetDataOptions | null = null;

      const mockRepository = {
        fetchBudgetData: (
          _id: string,
          _client: unknown,
          options: BudgetDataOptions,
        ) => {
          capturedOptions = options;
          return Promise.resolve({ budgetLines: [], transactions: [] });
        },
      };

      const mockEncryptionService = {
        ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
        encryptAmount: () => 'encrypted-mock',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BudgetCalculator,
          {
            provide: `INFO_LOGGER:${BudgetCalculator.name}`,
            useValue: createMockPinoLogger(),
          },
          {
            provide: BudgetRepository,
            useValue: mockRepository,
          },
          {
            provide: EncryptionService,
            useValue: mockEncryptionService,
          },
        ],
      }).compile();

      const calculator = module.get<BudgetCalculator>(BudgetCalculator);

      // ACT
      await calculator.calculateEndingBalance('budget-id', {} as any);

      // ASSERT - Verify the calculator requests the right fields
      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.budgetLineFields).toBe('id, kind, amount');
      expect(capturedOptions!.transactionFields).toBe(
        'id, kind, amount, budget_line_id',
      );
    });

    it('should handle free transactions (no budget_line_id) correctly', async () => {
      // ARRANGE
      const mockRepository = {
        fetchBudgetData: () =>
          Promise.resolve({
            budgetLines: [
              { id: 'line-1', kind: 'income', amount: 5000 },
              { id: 'line-2', kind: 'expense', amount: 500 },
            ],
            transactions: [
              {
                id: 'tx-1',
                kind: 'expense',
                amount: 100,
                budget_line_id: 'line-2',
              },
              { id: 'tx-2', kind: 'expense', amount: 75, budget_line_id: null },
            ],
          }),
      };

      const mockEncryptionService = {
        ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
        encryptAmount: () => 'encrypted-mock',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BudgetCalculator,
          {
            provide: `INFO_LOGGER:${BudgetCalculator.name}`,
            useValue: createMockPinoLogger(),
          },
          {
            provide: BudgetRepository,
            useValue: mockRepository,
          },
          {
            provide: EncryptionService,
            useValue: mockEncryptionService,
          },
        ],
      }).compile();

      const calculator = module.get<BudgetCalculator>(BudgetCalculator);

      // ACT
      const result = await calculator.calculateEndingBalance(
        'budget-id',
        {} as any,
      );

      // ASSERT
      // Income: 5000
      // Expenses: max(500, 100) + 75 (free) = 500 + 75 = 575
      // Ending balance = 5000 - 575 = 4425
      expect(result).toBe(4425);
    });

    it('should handle multiple transactions allocated to same envelope', async () => {
      // ARRANGE
      const mockRepository = {
        fetchBudgetData: () =>
          Promise.resolve({
            budgetLines: [
              { id: 'line-1', kind: 'income', amount: 5000 },
              { id: 'line-2', kind: 'expense', amount: 500 },
            ],
            transactions: [
              {
                id: 'tx-1',
                kind: 'expense',
                amount: 200,
                budget_line_id: 'line-2',
              },
              {
                id: 'tx-2',
                kind: 'expense',
                amount: 150,
                budget_line_id: 'line-2',
              },
            ],
          }),
      };

      const mockEncryptionService = {
        ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
        encryptAmount: () => 'encrypted-mock',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BudgetCalculator,
          {
            provide: `INFO_LOGGER:${BudgetCalculator.name}`,
            useValue: createMockPinoLogger(),
          },
          {
            provide: BudgetRepository,
            useValue: mockRepository,
          },
          {
            provide: EncryptionService,
            useValue: mockEncryptionService,
          },
        ],
      }).compile();

      const calculator = module.get<BudgetCalculator>(BudgetCalculator);

      // ACT
      const result = await calculator.calculateEndingBalance(
        'budget-id',
        {} as any,
      );

      // ASSERT
      // Income: 5000
      // Expenses: max(500, 200+150) = max(500, 350) = 500
      // Ending balance = 5000 - 500 = 4500
      expect(result).toBe(4500);
    });

    it('should handle savings as expenses per SPECS', async () => {
      // ARRANGE
      const mockRepository = {
        fetchBudgetData: () =>
          Promise.resolve({
            budgetLines: [
              { id: 'line-1', kind: 'income', amount: 5000 },
              { id: 'line-2', kind: 'expense', amount: 1000 },
              { id: 'line-3', kind: 'saving', amount: 500 },
            ],
            transactions: [],
          }),
      };

      const mockEncryptionService = {
        ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
        encryptAmount: () => 'encrypted-mock',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BudgetCalculator,
          {
            provide: `INFO_LOGGER:${BudgetCalculator.name}`,
            useValue: createMockPinoLogger(),
          },
          {
            provide: BudgetRepository,
            useValue: mockRepository,
          },
          {
            provide: EncryptionService,
            useValue: mockEncryptionService,
          },
        ],
      }).compile();

      const calculator = module.get<BudgetCalculator>(BudgetCalculator);

      // ACT
      const result = await calculator.calculateEndingBalance(
        'budget-id',
        {} as any,
      );

      // ASSERT
      // Income: 5000
      // Expenses: 1000 + 500 (saving treated as expense) = 1500
      // Ending balance = 5000 - 1500 = 3500
      expect(result).toBe(3500);
    });

    it('should return 0 when no data', async () => {
      // ARRANGE
      const mockRepository = {
        fetchBudgetData: () =>
          Promise.resolve({
            budgetLines: [],
            transactions: [],
          }),
      };

      const mockEncryptionService = {
        ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
        encryptAmount: () => 'encrypted-mock',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BudgetCalculator,
          {
            provide: `INFO_LOGGER:${BudgetCalculator.name}`,
            useValue: createMockPinoLogger(),
          },
          {
            provide: BudgetRepository,
            useValue: mockRepository,
          },
          {
            provide: EncryptionService,
            useValue: mockEncryptionService,
          },
        ],
      }).compile();

      const calculator = module.get<BudgetCalculator>(BudgetCalculator);

      // ACT
      const result = await calculator.calculateEndingBalance(
        'budget-id',
        {} as any,
      );

      // ASSERT
      expect(result).toBe(0);
    });

    it('should handle income transactions correctly', async () => {
      // ARRANGE
      const mockRepository = {
        fetchBudgetData: () =>
          Promise.resolve({
            budgetLines: [{ id: 'line-1', kind: 'income', amount: 5000 }],
            transactions: [
              { id: 'tx-1', kind: 'income', amount: 300, budget_line_id: null },
            ],
          }),
      };

      const mockEncryptionService = {
        ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
        encryptAmount: () => 'encrypted-mock',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BudgetCalculator,
          {
            provide: `INFO_LOGGER:${BudgetCalculator.name}`,
            useValue: createMockPinoLogger(),
          },
          {
            provide: BudgetRepository,
            useValue: mockRepository,
          },
          {
            provide: EncryptionService,
            useValue: mockEncryptionService,
          },
        ],
      }).compile();

      const calculator = module.get<BudgetCalculator>(BudgetCalculator);

      // ACT
      const result = await calculator.calculateEndingBalance(
        'budget-id',
        {} as any,
      );

      // ASSERT
      // Income: 5000 + 300 = 5300
      // Expenses: 0
      // Ending balance = 5300
      expect(result).toBe(5300);
    });
  });
});
