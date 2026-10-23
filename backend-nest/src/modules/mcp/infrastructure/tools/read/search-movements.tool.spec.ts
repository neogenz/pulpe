import { describe, expect, it, mock } from 'bun:test';
import type { TransactionSearchResult } from 'pulpe-shared';
import type { Tag } from '@modules/tag/domain/tag.entity';
import type { TagReadPort } from '@modules/tag/domain/ports/tag-read.port';
import type { TransactionSearchPort } from '@modules/transaction/domain/ports/transaction-search.port';
import { SearchMovementsTool } from './search-movements.tool';

const COURSES = '11111111-1111-4111-8111-111111111111';
const LOISIRS = '22222222-2222-4222-8222-222222222222';
const BUDGET = '44444444-4444-4444-8444-444444444444';

const result = (over: Partial<TransactionSearchResult>) =>
  ({
    id: '55555555-5555-4555-8555-555555555555',
    itemType: 'transaction',
    name: 'Migros',
    amount: 12.5,
    kind: 'expense',
    month: 3,
    year: 2026,
    budgetId: BUDGET,
    ...over,
  }) as TransactionSearchResult;

function setup(results: TransactionSearchResult[]) {
  const search = mock(async () => results);
  const tool = new SearchMovementsTool(
    { search } satisfies TransactionSearchPort,
    {
      list: async () =>
        [
          { id: COURSES, name: 'Courses' },
          { id: LOISIRS, name: 'Loisirs' },
        ] as Tag[],
    } satisfies TagReadPort,
  );
  return { tool, search };
}

describe('SearchMovementsTool', () => {
  it('should forward tagIds alone to the search port and show each result with its tag names', async () => {
    const { tool, search } = setup([
      result({ tagIds: [COURSES, LOISIRS] }),
      result({ itemType: 'budget_line', name: 'Marché', tagIds: [COURSES] }),
    ]);

    const { text } = await tool.execute({ tagIds: [COURSES] });

    expect(search).toHaveBeenCalledWith({
      q: undefined,
      years: undefined,
      tagIds: [COURSES],
    });
    const rows = text.split('\n');
    expect(rows[0]).toBe('Résultats (2)');
    expect(rows[1]).toEndWith(' · Tags : Courses, Loisirs');
    expect(rows[2]).toEndWith(' · Tags : Courses');
  });

  it('should still search by query alone and name the query in the header', async () => {
    const { tool, search } = setup([result({})]);

    const { text } = await tool.execute({ query: 'migros', years: [2026] });

    expect(search).toHaveBeenCalledWith({
      q: 'migros',
      years: [2026],
      tagIds: undefined,
    });
    expect(text.split('\n')[0]).toBe('Résultats pour « migros » (1)');
    expect(text).not.toContain('Tags');
  });

  it('should not print undefined when nothing matches a tag-only search', async () => {
    const { tool } = setup([]);

    expect((await tool.execute({ tagIds: [COURSES] })).text).toBe(
      'Aucun résultat.',
    );
  });

  it('should skip a result tag missing from the tag list', async () => {
    const { tool } = setup([
      result({ tagIds: ['33333333-3333-4333-8333-333333333333'] }),
    ]);

    const { text } = await tool.execute({ query: 'migros' });

    expect(text).not.toContain('Tags');
    expect(text).not.toContain('33333333');
  });

  it('should ask instead of searching when given neither a query nor a tag', async () => {
    const { tool, search } = setup([]);

    const result = await tool.execute({ years: [2026] });

    expect(result.text.startsWith('Information manquante')).toBe(true);
    expect(result.wrote).toBe(false);
    expect(search).not.toHaveBeenCalled();
  });
});
