import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BUDGET_RECALCULATION_PORT } from '../../budget/domain/ports/budget-recalculation.port';
import { DEMO_REPOSITORY } from '../domain/ports/demo-repository.port';
import type {
  DemoBudgetLineSeed,
  DemoSeededBudget,
  DemoTransactionSeed,
} from '../domain/demo.entity';
import { GenerateDemoDataUseCase } from './generate-demo-data.use-case';

const GROCERIES_ENVELOPE = 'Courses alimentaires';

function buildMockRepo() {
  return {
    insertTemplates: mock(async (rows: unknown[]) =>
      rows.map((_, i) => ({ id: `template-${i}` })),
    ),
    insertCanonicalTemplateLines: mock(async () => [
      {
        id: 'tl-0',
        templateId: 'template-0',
        name: GROCERIES_ENVELOPE,
        amount: 600,
        kind: 'expense' as const,
        recurrence: 'one_off' as const,
      },
    ]),
    insertBudgets: mock(async (rows: unknown[]) =>
      rows.map(
        (r, i) =>
          ({
            ...(r as object),
            id: `budget-${i}`,
            templateId: (r as { templateId: string }).templateId,
          }) as unknown,
      ),
    ),
    insertBudgetLines: mock(async (lines: DemoBudgetLineSeed[]) =>
      lines.map((line, i) => ({
        id: `budget-line-${i}`,
        budgetId: line.budgetId,
        name: line.name,
        amount: line.amount,
        kind: line.kind,
      })),
    ),
    insertTransactions: mock(async () => {}),
  };
}

function seededBudgets(repo: ReturnType<typeof buildMockRepo>) {
  const [[budgets]] = (repo.insertBudgets as ReturnType<typeof mock>).mock
    .calls;
  return budgets as DemoSeededBudget[];
}

function seededBudgetLines(repo: ReturnType<typeof buildMockRepo>) {
  const [[lines]] = (repo.insertBudgetLines as ReturnType<typeof mock>).mock
    .calls;
  return lines as DemoBudgetLineSeed[];
}

function seededTransactions(repo: ReturnType<typeof buildMockRepo>) {
  const [[transactions]] = (repo.insertTransactions as ReturnType<typeof mock>)
    .mock.calls;
  return transactions as DemoTransactionSeed[];
}

function isClosedMonth(budget: DemoSeededBudget, now: Date): boolean {
  if (budget.year !== now.getFullYear()) return budget.year < now.getFullYear();
  return budget.month < now.getMonth() + 1;
}

describe('GenerateDemoDataUseCase', () => {
  let useCase: GenerateDemoDataUseCase;
  let mockRepo: ReturnType<typeof buildMockRepo>;
  let module: TestingModule;

  beforeEach(async () => {
    mockRepo = buildMockRepo();

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [() => ({})] })],
      providers: [
        GenerateDemoDataUseCase,
        { provide: DEMO_REPOSITORY, useValue: mockRepo },
        {
          provide: BUDGET_RECALCULATION_PORT,
          useValue: { recalculate: mock(async () => {}) },
        },
        {
          provide: `INFO_LOGGER:${GenerateDemoDataUseCase.name}`,
          useValue: { info: mock(() => {}), warn: mock(() => {}) },
        },
      ],
    }).compile();

    useCase = module.get(GenerateDemoDataUseCase);
  });

  describe('execute - complete financial setup', () => {
    it('should create 4 templates via repository', async () => {
      await useCase.execute('user-1', {} as never);

      const [[templatesInserted]] = (
        mockRepo.insertTemplates as ReturnType<typeof mock>
      ).mock.calls;
      expect((templatesInserted as unknown[]).length).toBe(4);
    });

    it('should create 12 monthly budgets (6 past + 6 future)', async () => {
      await useCase.execute('user-1', {} as never);

      const [[budgetsInserted]] = (
        mockRepo.insertBudgets as ReturnType<typeof mock>
      ).mock.calls;
      expect((budgetsInserted as unknown[]).length).toBe(12);
    });

    it('should call recalculate for each budget', async () => {
      const mockRecalc = mock(async () => {});
      module = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, load: [() => ({})] })],
        providers: [
          GenerateDemoDataUseCase,
          { provide: DEMO_REPOSITORY, useValue: buildMockRepo() },
          {
            provide: BUDGET_RECALCULATION_PORT,
            useValue: { recalculate: mockRecalc },
          },
          {
            provide: `INFO_LOGGER:${GenerateDemoDataUseCase.name}`,
            useValue: { info: mock(() => {}), warn: mock(() => {}) },
          },
        ],
      }).compile();

      const uc = module.get(GenerateDemoDataUseCase);
      await uc.execute('user-1', {} as never);

      expect(mockRecalc.mock.calls.length).toBe(12);
    });

    it('should pass userId to repo encryption-aware methods', async () => {
      await useCase.execute('user-7', {} as never);

      const linesCall = (
        mockRepo.insertCanonicalTemplateLines as ReturnType<typeof mock>
      ).mock.calls[0];
      expect(linesCall[1]).toBe('user-7');

      const budgetLinesCall = (
        mockRepo.insertBudgetLines as ReturnType<typeof mock>
      ).mock.calls[0];
      expect(budgetLinesCall[1]).toBe('user-7');

      const transactionsCall = (
        mockRepo.insertTransactions as ReturnType<typeof mock>
      ).mock.calls[0];
      expect(transactionsCall[1]).toBe('user-7');
    });

    it('should throw if repository fails', async () => {
      mockRepo.insertTemplates = mock(async () => {
        throw new Error('DB error');
      });

      await expect(useCase.execute('user-1', {} as never)).rejects.toThrow(
        'DB error',
      );
    });
  });

  describe('execute - envelope consumption', () => {
    it('should attach a grocery actual to the grocery envelope of its own budget', async () => {
      await useCase.execute('user-1', {} as never);

      const linesByBudget = new Map(
        seededBudgetLines(mockRepo).map((line, index) => [
          line.budgetId,
          `budget-line-${index}`,
        ]),
      );
      const groceryActuals = seededTransactions(mockRepo).filter(
        (tx) => tx.name === 'Migros - Courses',
      );
      const attached = groceryActuals.filter(
        (tx) => tx.budgetLineId !== null && linesByBudget.has(tx.budgetId),
      );

      expect(attached.length).toBeGreaterThan(0);
      for (const actual of attached) {
        expect(actual.budgetLineId).toBe(
          linesByBudget.get(actual.budgetId) ?? null,
        );
      }
    });

    it('should leave an actual unattached when no envelope matches it', async () => {
      await useCase.execute('user-1', {} as never);

      const seededNames = new Set(
        seededBudgetLines(mockRepo).map((line) => line.name),
      );
      expect(seededNames.has('Restaurants/Sorties')).toBe(false);

      const restaurantActuals = seededTransactions(mockRepo).filter(
        (tx) => tx.name === 'Restaurant Molino',
      );

      expect(restaurantActuals.length).toBeGreaterThan(0);
      for (const actual of restaurantActuals) {
        expect(actual.budgetLineId).toBeNull();
      }
    });
  });

  describe('execute - pointage', () => {
    it('should check every budget line of a closed month and none of the current month', async () => {
      const now = new Date();

      await useCase.execute('user-1', {} as never);

      const budgetsById = new Map(
        seededBudgets(mockRepo).map((budget, index) => [
          `budget-${index}`,
          budget,
        ]),
      );
      const lines = seededBudgetLines(mockRepo);
      expect(lines.length).toBeGreaterThan(0);

      for (const line of lines) {
        const budget = budgetsById.get(line.budgetId);
        if (!budget) throw new Error(`unknown budget ${line.budgetId}`);

        if (isClosedMonth(budget, now)) {
          expect(line.checkedAt).not.toBeNull();
        } else {
          expect(line.checkedAt).toBeNull();
        }
      }
    });

    it('should check the actuals of closed months and leave the current month open', async () => {
      const now = new Date();

      await useCase.execute('user-1', {} as never);

      const budgetsById = new Map(
        seededBudgets(mockRepo).map((budget, index) => [
          `budget-${index}`,
          budget,
        ]),
      );
      const transactions = seededTransactions(mockRepo);
      expect(transactions.length).toBeGreaterThan(0);

      for (const transaction of transactions) {
        const budget = budgetsById.get(transaction.budgetId);
        if (!budget) throw new Error(`unknown budget ${transaction.budgetId}`);

        if (isClosedMonth(budget, now)) {
          expect(transaction.checkedAt).toBe(transaction.transactionDate);
        } else {
          expect(transaction.checkedAt).toBeNull();
        }
      }
    });
  });
});
