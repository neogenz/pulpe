import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { FindAllBudgetsUseCase } from './find-all-budgets.use-case';
import type { BudgetRepositoryPort } from '../domain/ports/budget-repository.port';
import type { Budget } from '../domain/budget.entity';

/**
 * Behaviour spec — locks the **persist-delta / read-time-rollover** contract.
 *
 * Cross-stack semantics that this test enforces:
 *
 *   monthly_budget.ending_balance      = current month delta only
 *                                        (income − expenses for that month)
 *   GET /budgets ↦ remaining           = ending_balance(stored) + rollover(prior months)
 *
 * Why this matters:
 *
 *   - iOS year sums `endingBalance` across months (BudgetListView+YearComponents.swift:13).
 *     If `endingBalance` were stored as cumulative (rollover already added), every
 *     prior month's rollover would compound into the next, double-counting the carry.
 *   - The webapp Excel export (`excel-export.service.ts:103`) renders `endingBalance`
 *     verbatim as the month's final delta. Cumulative storage would mislead users.
 *   - The frontend re-derives `endingBalance` locally with rollover; the API must
 *     surface the same number via `remaining` to keep client and server aligned.
 *
 * If anyone breaks this contract (e.g. persists rollover, drops rollover at read,
 * or makes the formula non-linear in rollover), this test fails before the bug
 * reaches a client.
 */

const USER_ID = 'user-1';
const CLIENT_KEY = Buffer.from('test-key');

const makeBudget = (
  id: string,
  month: number,
  year: number,
  delta: number,
): Budget => ({
  id,
  userId: USER_ID,
  templateId: 'tmpl-1',
  month,
  year,
  description: `${year}-${month}`,
  endingBalance: delta,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('FindAllBudgetsUseCase — persist-delta / read-time-rollover contract', () => {
  let useCase: FindAllBudgetsUseCase;
  let mockRepo: { fetchAllBudgets: ReturnType<typeof mock> };
  let mockCache: { getOrSet: ReturnType<typeof mock> };
  let mockSparse: { execute: ReturnType<typeof mock> };
  let mockRecalculate: {
    calculateEndingBalance: ReturnType<typeof mock>;
    getRollover: ReturnType<typeof mock>;
  };
  let mockLogger: {
    info: ReturnType<typeof mock>;
    debug: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
    trace: ReturnType<typeof mock>;
  };

  // Three consecutive months — each row stores ONLY the month's delta.
  // Jan delta = +500, Feb delta = +400, Mar delta = −100.
  const JAN = makeBudget('budget-jan', 1, 2026, 500);
  const FEB = makeBudget('budget-feb', 2, 2026, 400);
  const MAR = makeBudget('budget-mar', 3, 2026, -100);

  // Rollover seen by each month at READ time. These are prior-month CUMULATIVES,
  // computed by `calculateRolloverFromBudgets` from the same persisted deltas.
  // They are NEVER stored — they live at read time only.
  const ROLLOVER_BY_BUDGET: Record<string, number> = {
    'budget-jan': 0,
    'budget-feb': 500, // = Jan delta
    'budget-mar': 900, // = Jan delta + Feb delta
  };

  // Per-month delta returned by the formula (mirrors what's persisted).
  const DELTA_BY_BUDGET: Record<string, number> = {
    'budget-jan': 500,
    'budget-feb': 400,
    'budget-mar': -100,
  };

  beforeEach(() => {
    mockRepo = {
      fetchAllBudgets: mock(() => Promise.resolve([JAN, FEB, MAR])),
    };

    mockCache = {
      getOrSet: mock((_userId, _key, _ttl, fn) => fn()),
    };

    mockSparse = { execute: mock(() => Promise.resolve([])) };

    mockRecalculate = {
      calculateEndingBalance: mock((budgetId: string) =>
        Promise.resolve(DELTA_BY_BUDGET[budgetId]),
      ),
      getRollover: mock((budgetId: string) =>
        Promise.resolve({
          rollover: ROLLOVER_BY_BUDGET[budgetId],
          previousBudgetId: null,
        }),
      ),
    };

    mockLogger = {
      info: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      trace: mock(() => {}),
    };

    useCase = new FindAllBudgetsUseCase(
      mockRepo as unknown as BudgetRepositoryPort,
      mockCache as never,
      mockSparse as never,
      mockRecalculate as never,
      mockLogger as never,
    );
  });

  const fakeUser = {
    id: USER_ID,
    email: 'a@b.c',
    accessToken: 't',
    clientKey: CLIENT_KEY,
  };
  const fakeSupabase = {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: { user_metadata: { payDayOfMonth: 1 } } },
        }),
    },
  };

  it('should return remaining = persisted delta + rollover for each month (live recompute path)', async () => {
    const result = await useCase.execute(
      fakeUser as never,
      fakeSupabase as never,
    );

    if (result.kind !== 'list') throw new Error('expected list result');

    const byId = Object.fromEntries(result.budgets.map((b) => [b.id, b]));
    expect(byId['budget-jan'].remaining).toBe(500); // 500 + 0
    expect(byId['budget-feb'].remaining).toBe(900); // 400 + 500
    expect(byId['budget-mar'].remaining).toBe(800); // -100 + 900
  });

  it('should never store rollover into endingBalance — persisted column stays the month delta', async () => {
    const result = await useCase.execute(
      fakeUser as never,
      fakeSupabase as never,
    );

    if (result.kind !== 'list') throw new Error('expected list result');

    // Stored endingBalance per row equals the month delta returned by the formula
    // (mock matches DB). It must NOT equal the read-time `remaining`. If a future
    // change persists `delta + rollover`, this assertion fails for Feb / Mar.
    for (const budget of result.budgets) {
      expect(budget.endingBalance).toBe(DELTA_BY_BUDGET[budget.id]);
    }

    // Sanity: Feb / Mar remaining differ from their persisted value because rollover
    // is non-zero. If they ever match, rollover got merged into the column.
    const feb = result.budgets.find((b) => b.id === 'budget-feb');
    const mar = result.budgets.find((b) => b.id === 'budget-mar');
    expect(feb?.remaining).not.toBe(feb?.endingBalance);
    expect(mar?.remaining).not.toBe(mar?.endingBalance);
  });

  it('should preserve cross-month additivity — Σ persisted endingBalance = final cumulative remaining', async () => {
    // iOS contract from `BudgetListView+YearComponents.swift:13`:
    //   Sum of endingBalance per month = remaining - rollover, no double-count.
    // Equivalently: the last month's `remaining` MUST equal the running sum of
    // every month's persisted `endingBalance` (plus initial rollover, which is 0
    // here since Jan has no prior month).
    const result = await useCase.execute(
      fakeUser as never,
      fakeSupabase as never,
    );

    if (result.kind !== 'list') throw new Error('expected list result');

    const totalPersistedDelta = result.budgets.reduce(
      (sum, b) => sum + (b.endingBalance ?? 0),
      0,
    );
    const lastMonthRemaining = result.budgets.find(
      (b) => b.id === 'budget-mar',
    )!.remaining;

    expect(totalPersistedDelta).toBe(lastMonthRemaining);
  });
});
