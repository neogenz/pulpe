import { describe, it, expect } from 'bun:test';
import {
  POSTGREST_FILTER_CHUNK_SIZE,
  POSTGREST_PAGE_SIZE,
  fetchAllPages,
  fetchRowsByParentIds,
} from './postgrest-pagination';

/** A source of `total` rows that answers `.range(from, to)` the way PostgREST does. */
function pagedSource(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: `row-${i}` }));
  const ranges: Array<[number, number]> = [];
  return {
    ranges,
    page: (from: number, to: number) => {
      ranges.push([from, to]);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    },
  };
}

describe('fetchAllPages', () => {
  it('returns the rows a single truncated page would have dropped', async () => {
    const source = pagedSource(POSTGREST_PAGE_SIZE + 1);

    const rows = await fetchAllPages(source.page);

    expect(rows).toHaveLength(POSTGREST_PAGE_SIZE + 1);
    expect(source.ranges).toEqual([
      [0, POSTGREST_PAGE_SIZE - 1],
      [POSTGREST_PAGE_SIZE, POSTGREST_PAGE_SIZE * 2 - 1],
    ]);
  });

  it('stops on the first short page', async () => {
    const source = pagedSource(3);

    const rows = await fetchAllPages(source.page);

    expect(rows).toHaveLength(3);
    expect(source.ranges).toEqual([[0, POSTGREST_PAGE_SIZE - 1]]);
  });

  it('asks for one more page when the count is an exact multiple of the page size', async () => {
    const source = pagedSource(POSTGREST_PAGE_SIZE);

    const rows = await fetchAllPages(source.page);

    expect(rows).toHaveLength(POSTGREST_PAGE_SIZE);
    expect(source.ranges).toHaveLength(2);
  });

  it('raises the query error instead of returning a partial set', async () => {
    const boom = new Error('connection reset');

    await expect(
      fetchAllPages(() => Promise.resolve({ data: null, error: boom })),
    ).rejects.toBe(boom);
  });

  it('refuses an ambiguous reply with neither rows nor error', async () => {
    await expect(
      fetchAllPages(() => Promise.resolve({ data: null, error: null })),
    ).rejects.toThrow('Ambiguous Supabase response');
  });
});

describe('fetchRowsByParentIds', () => {
  it('splits the ids into chunks and keeps the rows of every chunk', async () => {
    const parentIds = Array.from(
      { length: POSTGREST_FILTER_CHUNK_SIZE + 1 },
      (_, i) => `parent-${i}`,
    );
    const seenChunks: string[][] = [];

    const rows = await fetchRowsByParentIds(parentIds, (ids) => {
      seenChunks.push(ids);
      return Promise.resolve({
        data: ids.map((id) => ({ id })),
        error: null,
      });
    });

    expect(seenChunks.map((c) => c.length)).toEqual([
      POSTGREST_FILTER_CHUNK_SIZE,
      1,
    ]);
    expect(rows).toHaveLength(POSTGREST_FILTER_CHUNK_SIZE + 1);
  });

  it('pages inside a chunk as well as across chunks', async () => {
    const source = pagedSource(POSTGREST_PAGE_SIZE + 5);

    const rows = await fetchRowsByParentIds(['parent-1'], (_ids, from, to) =>
      source.page(from, to),
    );

    expect(rows).toHaveLength(POSTGREST_PAGE_SIZE + 5);
  });

  it('reads nothing when there is no parent', async () => {
    let called = false;

    const rows = await fetchRowsByParentIds([], () => {
      called = true;
      return Promise.resolve({ data: [], error: null });
    });

    expect(rows).toEqual([]);
    expect(called).toBe(false);
  });
});
