import { describe, expect, it, mock } from 'bun:test';
import type {
  BudgetLineDecrypted,
  BudgetWithDetails,
  TransactionDecrypted,
} from '@modules/budget/domain/budget.entity';
import type { BudgetMonthReadPort } from '@modules/budget/domain/ports/budget-month-read.port';
import type { Tag } from '@modules/tag/domain/tag.entity';
import type { TagReadPort } from '@modules/tag/domain/ports/tag-read.port';
import { GetMonthTool } from './get-month.tool';

const COURSES = '11111111-1111-4111-8111-111111111111';
const LOISIRS = '22222222-2222-4222-8222-222222222222';
const DELETED = '33333333-3333-4333-8333-333333333333';

const line = (over: Partial<BudgetLineDecrypted>) =>
  ({
    kind: 'expense',
    recurrence: 'one_off',
    amount: 10,
    checkedAt: null,
    sourceSavingsGoalId: null,
    tagIds: [],
    ...over,
  }) as BudgetLineDecrypted;

const movement = (over: Partial<TransactionDecrypted>) =>
  ({
    kind: 'expense',
    amount: 10,
    transactionDate: '2026-03-12',
    checkedAt: null,
    tagIds: [],
    ...over,
  }) as TransactionDecrypted;

const MONTH = {
  budget: { id: 'budget-1', month: 3, year: 2026 },
  budgetLines: [
    line({ id: 'l-tagged', name: 'Marché', tagIds: [COURSES, LOISIRS] }),
    line({ id: 'l-plain', name: 'Loyer' }),
    line({ id: 'l-stale', name: 'Ancien', tagIds: [DELETED] }),
  ],
  transactions: [
    movement({ id: 't-tagged', name: 'Migros', tagIds: [COURSES] }),
    movement({ id: 't-plain', name: 'Café' }),
  ],
  rollover: 0,
  previousBudgetId: null,
} as unknown as BudgetWithDetails;

function setup() {
  const budgets = {
    readMonth: async () => MONTH,
    listMonths: async () => [],
  } satisfies BudgetMonthReadPort;
  const list = mock(
    async () =>
      [
        { id: COURSES, name: 'Courses' },
        { id: LOISIRS, name: 'Loisirs' },
      ] as Tag[],
  );
  const tool = new GetMonthTool(budgets, { list } satisfies TagReadPort);
  const rowOf = (text: string, id: string) =>
    text.split('\n').find((row) => row.startsWith(`- [${id}]`));
  return { tool, list, rowOf };
}

describe('GetMonthTool tag names', () => {
  it('should end a tagged prévision and a tagged mouvement with their tag names', async () => {
    const { tool, rowOf } = setup();

    const { text } = await tool.execute({ month: 3, year: 2026 });

    expect(rowOf(text, 'l-tagged')).toEndWith(' · Tags : Courses, Loisirs');
    expect(rowOf(text, 't-tagged')).toEndWith(' · Tags : Courses');
  });

  it('should add nothing to an untagged line', async () => {
    const { tool, rowOf } = setup();

    const { text } = await tool.execute({ month: 3, year: 2026 });

    expect(rowOf(text, 'l-plain')).not.toContain('Tags');
    expect(rowOf(text, 't-plain')).not.toContain('Tags');
  });

  it('should print neither a name nor the raw id for a tag missing from the tag list', async () => {
    const { tool, rowOf } = setup();

    const { text } = await tool.execute({ month: 3, year: 2026 });

    expect(rowOf(text, 'l-stale')).not.toContain('Tags');
    expect(text).not.toContain(DELETED);
  });

  it('should read the tags once per call', async () => {
    const { tool, list } = setup();

    await tool.execute({ month: 3, year: 2026 });

    expect(list).toHaveBeenCalledTimes(1);
  });
});
