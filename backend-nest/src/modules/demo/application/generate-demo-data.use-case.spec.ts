import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BUDGET_RECALCULATION_PORT } from '../../budget/domain/ports/budget-recalculation.port';
import { DEMO_REPOSITORY } from '../domain/ports/demo-repository.port';
import type {
  DemoBudgetLineSeed,
  DemoSavingsGoalSeed,
  DemoSeededBudget,
  DemoTransactionSeed,
} from '../domain/demo.entity';
import {
  DEMO_SAVINGS_GOAL_SPECS,
  DEMO_SPREAD_SPEC,
} from '../domain/demo.constants';
import { GenerateDemoDataUseCase } from './generate-demo-data.use-case';

const GROCERIES_ENVELOPE = 'Courses alimentaires';
const HOUSING_SAVINGS_ENVELOPE = 'Épargne logement';

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
      {
        id: 'tl-1',
        templateId: 'template-0',
        name: HOUSING_SAVINGS_ENVELOPE,
        amount: 1000,
        kind: 'saving' as const,
        recurrence: 'fixed' as const,
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
    insertSavingsGoals: mock(async (goals: DemoSavingsGoalSeed[]) =>
      goals.map((goal, i) => ({ id: `goal-${i}`, name: goal.name })),
    ),
    linkBudgetLinesToSavingsGoal: mock(async () => {}),
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

function seededSavingsGoals(repo: ReturnType<typeof buildMockRepo>) {
  const [[goals]] = (repo.insertSavingsGoals as ReturnType<typeof mock>).mock
    .calls;
  return goals as DemoSavingsGoalSeed[];
}

function savingsGoalLinkCalls(repo: ReturnType<typeof buildMockRepo>) {
  return (repo.linkBudgetLinesToSavingsGoal as ReturnType<typeof mock>).mock
    .calls as [string[], string, unknown][];
}

function identifiedBudgetLines(repo: ReturnType<typeof buildMockRepo>) {
  return seededBudgetLines(repo).map((line, index) => ({
    line,
    id: `budget-line-${index}`,
  }));
}

function spreadTranches(lines: DemoBudgetLineSeed[]) {
  return lines.filter((line) => line.spreadGroupId !== null);
}

function isClosedMonth(budget: DemoSeededBudget, now: Date): boolean {
  if (budget.year !== now.getFullYear()) return budget.year < now.getFullYear();
  return budget.month < now.getMonth() + 1;
}

function isFutureMonth(budget: DemoSeededBudget, now: Date): boolean {
  if (budget.year !== now.getFullYear()) return budget.year > now.getFullYear();
  return budget.month > now.getMonth() + 1;
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

      const groceryLineByBudget = new Map(
        identifiedBudgetLines(mockRepo)
          .filter(({ line }) => line.name === GROCERIES_ENVELOPE)
          .map(({ line, id }) => [line.budgetId, id]),
      );
      const groceryActuals = seededTransactions(mockRepo).filter(
        (tx) => tx.name === 'Migros - Courses',
      );
      const attached = groceryActuals.filter(
        (tx) =>
          tx.budgetLineId !== null && groceryLineByBudget.has(tx.budgetId),
      );

      expect(attached.length).toBeGreaterThan(0);
      for (const actual of attached) {
        expect(actual.budgetLineId).toBe(
          groceryLineByBudget.get(actual.budgetId) ?? null,
        );
      }
    });

    it('should give the month in progress its actuals whatever the day of the month', async () => {
      const now = new Date();

      await useCase.execute('user-1', {} as never);

      const currentMonthIndex = seededBudgets(mockRepo).findIndex(
        (budget) =>
          budget.month === now.getMonth() + 1 &&
          budget.year === now.getFullYear(),
      );
      const currentMonthActuals = seededTransactions(mockRepo).filter(
        (tx) => tx.budgetId === `budget-${currentMonthIndex}`,
      );

      expect(currentMonthActuals.length).toBeGreaterThan(0);
      for (const actual of currentMonthActuals) {
        expect(new Date(actual.transactionDate) <= now).toBe(true);
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

  describe('execute - savings goals', () => {
    it('should seed one dated goal, one open-ended goal and one already reached', async () => {
      await useCase.execute('user-1', {} as never);

      const goals = seededSavingsGoals(mockRepo);

      expect(
        goals.filter((g) => g.status === 'ACTIVE' && g.targetDate !== null)
          .length,
      ).toBe(1);
      expect(
        goals.filter((g) => g.status === 'ACTIVE' && g.targetDate === null)
          .length,
      ).toBe(1);
      expect(goals.filter((g) => g.status === 'COMPLETED').length).toBe(1);
    });

    it('should seed the completed goal at its target amount', async () => {
      await useCase.execute('user-1', {} as never);

      const completed = seededSavingsGoals(mockRepo).find(
        (g) => g.status === 'COMPLETED',
      );
      if (!completed) throw new Error('no completed goal seeded');

      expect(completed.initialAmount).toBe(completed.targetAmount);
    });

    it('should link every saving prévision bearing the goal envelope name', async () => {
      await useCase.execute('user-1', {} as never);

      const housingLineIds = identifiedBudgetLines(mockRepo)
        .filter(({ line }) => line.name === HOUSING_SAVINGS_ENVELOPE)
        .map(({ id }) => id);
      const housingSpec = DEMO_SAVINGS_GOAL_SPECS.find(
        (spec) => spec.envelopeName === HOUSING_SAVINGS_ENVELOPE,
      );
      if (!housingSpec)
        throw new Error('no goal funded by the housing envelope');
      const housingGoalIndex = seededSavingsGoals(mockRepo).findIndex(
        (goal) => goal.name === housingSpec.name,
      );

      expect(housingLineIds.length).toBeGreaterThan(0);
      const linkCall = savingsGoalLinkCalls(mockRepo).find(
        ([, goalId]) => goalId === `goal-${housingGoalIndex}`,
      );
      expect(linkCall?.[0]).toEqual(housingLineIds);
    });

    it('should never link a prévision to a goal that no envelope funds', async () => {
      await useCase.execute('user-1', {} as never);

      const goals = seededSavingsGoals(mockRepo);
      const unfundedSpecs = DEMO_SAVINGS_GOAL_SPECS.filter(
        (spec) => spec.envelopeName === null,
      );
      expect(unfundedSpecs.length).toBeGreaterThan(0);

      const linkedGoalIds = new Set(
        savingsGoalLinkCalls(mockRepo).map(([, goalId]) => goalId),
      );
      for (const spec of unfundedSpecs) {
        const index = goals.findIndex((goal) => goal.name === spec.name);
        expect(linkedGoalIds.has(`goal-${index}`)).toBe(false);
      }
    });

    it('should never link a prévision past the deadline the database enforces', async () => {
      await useCase.execute('user-1', {} as never);

      const budgetsById = new Map(
        seededBudgets(mockRepo).map((budget, index) => [
          `budget-${index}`,
          budget,
        ]),
      );
      const lineById = new Map(
        identifiedBudgetLines(mockRepo).map(({ line, id }) => [id, line]),
      );
      const goals = seededSavingsGoals(mockRepo);
      let checkedPairs = 0;

      for (const [lineIds, goalId] of savingsGoalLinkCalls(mockRepo)) {
        const goal = goals[Number(goalId.replace('goal-', ''))];
        if (!goal?.targetDate) continue;
        const deadline = new Date(goal.targetDate);

        for (const lineId of lineIds) {
          const budget = budgetsById.get(lineById.get(lineId)?.budgetId ?? '');
          if (!budget) throw new Error(`unknown budget for line ${lineId}`);

          expect(new Date(budget.year, budget.month - 1) <= deadline).toBe(
            true,
          );
          checkedPairs++;
        }
      }

      expect(checkedPairs).toBeGreaterThan(0);
    });

    it('should link checked prévisions so a goal shows progress', async () => {
      await useCase.execute('user-1', {} as never);

      const linkedIds = new Set(
        savingsGoalLinkCalls(mockRepo).flatMap(([ids]) => ids),
      );
      const checkedLinked = identifiedBudgetLines(mockRepo).filter(
        ({ line, id }) => linkedIds.has(id) && line.checkedAt !== null,
      );

      expect(checkedLinked.length).toBeGreaterThan(0);
    });
  });

  describe('execute - lissage', () => {
    it('should split the spread total into tranches summing back to it', async () => {
      await useCase.execute('user-1', {} as never);

      const tranches = spreadTranches(seededBudgetLines(mockRepo));
      const totalCents = tranches.reduce(
        (sum, line) => sum + Math.round(line.amount * 100),
        0,
      );

      expect(tranches.length).toBe(DEMO_SPREAD_SPEC.monthCount);
      expect(totalCents).toBe(Math.round(DEMO_SPREAD_SPEC.totalAmount * 100));
    });

    it('should make the tranches siblings of one group, none issued from the Mois Type', async () => {
      await useCase.execute('user-1', {} as never);

      const tranches = spreadTranches(seededBudgetLines(mockRepo));

      expect(new Set(tranches.map((line) => line.spreadGroupId)).size).toBe(1);
      expect(tranches.every((line) => line.templateLineId === null)).toBe(true);
      expect(tranches.every((line) => line.recurrence === 'one_off')).toBe(
        true,
      );
    });

    it('should mint a distinct group id for each demo session', async () => {
      await useCase.execute('user-1', {} as never);
      await useCase.execute('user-2', {} as never);

      const [firstCall, secondCall] = (
        mockRepo.insertBudgetLines as ReturnType<typeof mock>
      ).mock.calls;
      const firstGroupId = spreadTranches(
        firstCall[0] as DemoBudgetLineSeed[],
      )[0]?.spreadGroupId;
      const secondGroupId = spreadTranches(
        secondCall[0] as DemoBudgetLineSeed[],
      )[0]?.spreadGroupId;

      expect(firstGroupId).toBeTruthy();
      expect(secondGroupId).not.toBe(firstGroupId);
    });

    it('should straddle the current month so months remain to provision', async () => {
      const now = new Date();

      await useCase.execute('user-1', {} as never);

      const budgetsById = new Map(
        seededBudgets(mockRepo).map((budget, index) => [
          `budget-${index}`,
          budget,
        ]),
      );
      const trancheBudgets = spreadTranches(seededBudgetLines(mockRepo)).map(
        (line) => budgetsById.get(line.budgetId),
      );

      expect(
        trancheBudgets.some((budget) => budget && isClosedMonth(budget, now)),
      ).toBe(true);
      expect(
        trancheBudgets.some((budget) => budget && isFutureMonth(budget, now)),
      ).toBe(true);
    });
  });
});
