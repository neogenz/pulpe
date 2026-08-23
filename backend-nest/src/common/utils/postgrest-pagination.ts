/**
 * PostgREST truncates any response past `max_rows` (1 000 on this project, see
 * `supabase/config.toml`) and says nothing about it — the reply is a short array,
 * not an error. A batched read that folds several parents into one
 * `.in('parent_id', ids)` call therefore returns a partial row set as soon as the
 * account grows, and whatever is computed from it is silently wrong.
 *
 * Both helpers read until a page comes back short. Every paged query MUST carry a
 * total order (`.order('id', …)`); without one Postgres is free to reorder between
 * pages, and rows would be skipped or counted twice.
 */

export const POSTGREST_PAGE_SIZE = 1_000;
export const POSTGREST_FILTER_CHUNK_SIZE = 100;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/** Read one query page by page until a page comes back short. */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PageResult<T>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += POSTGREST_PAGE_SIZE) {
    const { data, error } = await fetchPage(
      from,
      from + POSTGREST_PAGE_SIZE - 1,
    );
    if (error) throw error;
    if (data === null) throw new Error('Ambiguous Supabase response');

    rows.push(...data);
    if (data.length < POSTGREST_PAGE_SIZE) return rows;
  }
}

/**
 * Read the rows of many parents: the ids are chunked so the URL stays within
 * PostgREST's limits, and each chunk is then paged to the end.
 */
export async function fetchRowsByParentIds<T>(
  parentIds: string[],
  fetchPage: (ids: string[], from: number, to: number) => PageResult<T>,
): Promise<T[]> {
  const rows: T[] = [];
  for (
    let offset = 0;
    offset < parentIds.length;
    offset += POSTGREST_FILTER_CHUNK_SIZE
  ) {
    const ids = parentIds.slice(offset, offset + POSTGREST_FILTER_CHUNK_SIZE);
    rows.push(...(await fetchAllPages((from, to) => fetchPage(ids, from, to))));
  }
  return rows;
}
