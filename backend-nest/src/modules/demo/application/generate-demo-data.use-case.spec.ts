import { describe, it, expect, beforeEach, jest, mock } from 'bun:test';
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
  DEMO_TEMPLATE_ORDER,
  type DemoTemplateKey,
} from '../domain/demo.constants';
import { templateKeyForMonth } from '../domain/demo-seed.builders';
import { MONTH_TRANSACTION_SPECS } from '../domain/demo-transaction-seeds';
import { GenerateDemoDataUseCase } from './generate-demo-data.use-case';

const GROCERIES_ENVELOPE = 'Courses alimentaires';
const HOUSING_SAVINGS_ENVELOPE = 'Épargne logement';
const EMERGENCY_SAVINGS_ENVELOPE = "Fonds d'urgence";

/**
 * The saving envelopes each template really carries, mirroring
 * `demo-template-specs.ts`: the vacation month funds no goal, and the holiday
 * month funds only the housing one. Giving every template the same savings
 * block would let a Mois Type be tagged for a goal it does not fund.
 */
const SAVING_ENVELOPES_BY_TEMPLATE: Record<DemoTemplateKey, string[]> = {
  STANDARD: [HOUSING_SAVINGS_ENVELOPE, EMERGENCY_SAVINGS_ENVELOPE],
  VACATIONS: [],
  SAVINGS: [HOUSING_SAVINGS_ENVELOPE, EMERGENCY_SAVINGS_ENVELOPE],
  HOLIDAYS: [HOUSING_SAVINGS_ENVELOPE],
};

/**
 * Every template carries the envelopes its own month's actuals name, mirroring
 * the real specs: a mock giving lines to the standard template alone would hide
 * exactly the gap that left themed months showing nothing consumed.
 */
function mockCanonicalTemplateLines() {
  return DEMO_TEMPLATE_ORDER.flatMap((key, templateIndex) => {
    const templateId = `template-${templateIndex}`;
    const envelopeLines = [
      ...new Set(MONTH_TRANSACTION_SPECS[key].map((spec) => spec.envelopeName)),
    ].map((name, i) => ({
      id: `tl-${templateIndex}-${i}`,
      templateId,
      name,
      amount: 600,
      kind: 'expense' as const,
      recurrence: 'one_off' as const,
    }));

    return [
      ...envelopeLines,
      ...SAVING_ENVELOPES_BY_TEMPLATE[key].map((name, i) => ({
        id: `tl-${templateIndex}-saving-${i}`,
        templateId,
        name,
        amount: 1000,
        kind: 'saving' as const,
        recurrence: 'fixed' as const,
      })),
    ];
  });
}

/**
 * Budgets are seeded chronologically, so a budget's index tells its month apart:
 * the first six are closed, index 6 is the month in progress, the rest are ahead.
 * The count is pinned by "should create 12 monthly budgets (6 past + 6 future)".
 */
const CLOSED_MONTH_COUNT = 6;
const CURRENT_MONTH_INDEX = CLOSED_MONTH_COUNT;

function buildMockRepo() {
  return {
    insertTemplates: mock(async (rows: unknown[]) =>
      rows.map((_, i) => ({ id: `template-${i}` })),
    ),
    insertCanonicalTemplateLines: mock(async () =>
      mockCanonicalTemplateLines(),
    ),
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
        kind: line.kind,
      })),
    ),
    insertTransactions: mock(async () => {}),
    insertSavingsGoals: mock(async (goals: DemoSavingsGoalSeed[]) =>
      goals.map((goal, i) => ({ id: `goal-${i}`, name: goal.name })),
    ),
    linkBudgetLinesToSavingsGoal: mock(async () => {}),
    linkTemplateLinesToSavingsGoal: mock(async () => {}),
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

function templateLineLinkCalls(repo: ReturnType<typeof buildMockRepo>) {
  return (repo.linkTemplateLinesToSavingsGoal as ReturnType<typeof mock>).mock
    .calls as [string[], string, unknown][];
}

function goalIdByName(repo: ReturnType<typeof buildMockRepo>, name: string) {
  return `goal-${seededSavingsGoals(repo).findIndex((goal) => goal.name === name)}`;
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

function budgetIndexById(repo: ReturnType<typeof buildMockRepo>) {
  return new Map(
    seededBudgets(repo).map((_, index) => [`budget-${index}`, index]),
  );
}

function monthIndexOf(
  indexById: Map<string, number>,
  budgetId: string,
): number {
  const index = indexById.get(budgetId);
  if (index === undefined) throw new Error(`unknown budget ${budgetId}`);
  return index;
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

    it('should attach every actual to an envelope of its own budget, themed months included', async () => {
      await useCase.execute('user-1', {} as never);

      const lineById = new Map(
        identifiedBudgetLines(mockRepo).map(({ line, id }) => [id, line]),
      );
      const themedBudgetIds = new Set(
        seededBudgets(mockRepo).flatMap((budget, index) =>
          templateKeyForMonth(budget.month) === 'STANDARD'
            ? []
            : [`budget-${index}`],
        ),
      );
      const actuals = seededTransactions(mockRepo);

      expect(actuals.length).toBeGreaterThan(0);
      expect(actuals.some((tx) => themedBudgetIds.has(tx.budgetId))).toBe(true);
      for (const actual of actuals) {
        expect(lineById.get(actual.budgetLineId ?? '')?.budgetId).toBe(
          actual.budgetId,
        );
      }
    });

    it('should open every template set on the 1st so a month in progress is never empty', () => {
      for (const key of DEMO_TEMPLATE_ORDER) {
        const days = MONTH_TRANSACTION_SPECS[key].map((spec) => spec.day);

        expect(days.length).toBeGreaterThan(0);
        expect(Math.min(...days)).toBe(1);
      }
    });
  });

  describe('execute - pointage', () => {
    it('should check every budget line of a closed month and none of the current month', async () => {
      await useCase.execute('user-1', {} as never);

      const indexById = budgetIndexById(mockRepo);
      const lines = seededBudgetLines(mockRepo);
      expect(lines.length).toBeGreaterThan(0);

      for (const line of lines) {
        if (monthIndexOf(indexById, line.budgetId) < CLOSED_MONTH_COUNT) {
          expect(line.checkedAt).not.toBeNull();
        } else {
          expect(line.checkedAt).toBeNull();
        }
      }
    });

    it('should check the actuals of closed months and leave the current month open', async () => {
      await useCase.execute('user-1', {} as never);

      const indexById = budgetIndexById(mockRepo);
      const transactions = seededTransactions(mockRepo);
      expect(transactions.length).toBeGreaterThan(0);

      for (const transaction of transactions) {
        if (
          monthIndexOf(indexById, transaction.budgetId) < CLOSED_MONTH_COUNT
        ) {
          expect(transaction.checkedAt).toBe(transaction.transactionDate);
        } else {
          expect(transaction.checkedAt).toBeNull();
        }
      }
    });
  });

  describe('execute - one clock per session', () => {
    const SEED_INSTANT = new Date(2026, 0, 15, 12);
    const SEED_MONTH = { month: 1, year: 2026 };
    const FIRST_SEEDED_MONTH = '2025-07-01';

    function advanceClockFrom(
      repoMethod: keyof ReturnType<typeof buildMockRepo>,
      to: Date,
    ) {
      const original = mockRepo[repoMethod] as (
        ...args: unknown[]
      ) => Promise<unknown>;
      mockRepo[repoMethod] = mock(async (...args: unknown[]) => {
        jest.setSystemTime(to);
        return original(...args);
      }) as never;
    }

    it('should derive every seed from one instant even when the clock crosses months mid-run', async () => {
      jest.setSystemTime(SEED_INSTANT);
      advanceClockFrom('insertBudgets', new Date(2026, 3, 15, 12));
      advanceClockFrom('insertBudgetLines', new Date(2026, 4, 15, 12));
      advanceClockFrom('insertTransactions', new Date(2026, 5, 15, 12));

      try {
        await useCase.execute('user-1', {} as never);
      } finally {
        jest.setSystemTime();
      }

      const seedMonthIndex = seededBudgets(mockRepo).findIndex(
        (budget) =>
          budget.month === SEED_MONTH.month && budget.year === SEED_MONTH.year,
      );
      const seedMonthId = `budget-${seedMonthIndex}`;
      const lines = seededBudgetLines(mockRepo);

      expect(spreadTranches(lines).length).toBe(DEMO_SPREAD_SPEC.monthCount);
      for (const line of lines.filter((l) => l.budgetId === seedMonthId)) {
        expect(line.checkedAt).toBeNull();
      }
      for (const actual of seededTransactions(mockRepo).filter(
        (tx) => tx.budgetId === seedMonthId,
      )) {
        expect(actual.checkedAt).toBeNull();
      }
      for (const goal of seededSavingsGoals(mockRepo)) {
        expect(goal.startDate).toBe(FIRST_SEEDED_MONTH);
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

    it('should tag the Mois Type for the open-ended goal so a later budget keeps the link', async () => {
      await useCase.execute('user-1', {} as never);

      const openEnded = DEMO_SAVINGS_GOAL_SPECS.find(
        (spec) => spec.monthsUntilTarget === null && spec.envelopeName !== null,
      );
      const envelopeName = openEnded?.envelopeName;
      if (!openEnded || !envelopeName) {
        throw new Error('no open-ended goal fed by an envelope');
      }
      const recurringLineIds = mockCanonicalTemplateLines()
        .filter((line) => line.kind === 'saving' && line.name === envelopeName)
        .map((line) => line.id);

      expect(recurringLineIds.length).toBeGreaterThan(0);
      const linkCall = templateLineLinkCalls(mockRepo).find(
        ([, goalId]) => goalId === goalIdByName(mockRepo, openEnded.name),
      );
      expect(linkCall?.[0]).toEqual(recurringLineIds);
    });

    it('should never tag the Mois Type for a dated goal', async () => {
      await useCase.execute('user-1', {} as never);

      const datedGoalIds = new Set(
        DEMO_SAVINGS_GOAL_SPECS.filter(
          (spec) => spec.monthsUntilTarget !== null,
        ).map((spec) => goalIdByName(mockRepo, spec.name)),
      );
      const taggedGoalIds = templateLineLinkCalls(mockRepo).map(
        ([, goalId]) => goalId,
      );

      expect(datedGoalIds.size).toBeGreaterThan(0);
      expect(taggedGoalIds.length).toBeGreaterThan(0);
      for (const goalId of taggedGoalIds) {
        expect(datedGoalIds.has(goalId)).toBe(false);
      }
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
      await useCase.execute('user-1', {} as never);

      const indexById = budgetIndexById(mockRepo);
      const trancheMonths = spreadTranches(seededBudgetLines(mockRepo)).map(
        (line) => monthIndexOf(indexById, line.budgetId),
      );

      expect(trancheMonths.some((index) => index < CURRENT_MONTH_INDEX)).toBe(
        true,
      );
      expect(trancheMonths.some((index) => index > CURRENT_MONTH_INDEX)).toBe(
        true,
      );
    });
  });
});
