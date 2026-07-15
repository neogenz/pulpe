import { isGroupHeaderRow, type TableRowItem } from './table-items.view-model';

/**
 * Tag-based filtering for the budget-details table/grid (PUL-18 PR4).
 *
 * Both helpers are pure so the container can derive filtered rows reactively and
 * the logic stays unit-testable without a TestBed. `tagIds` lives on the main
 * budget-line / transaction reads (not the RPC-fed consumption projections), so
 * filtering happens on the already-built rows — consumption is baked into each
 * row before filtering and is therefore preserved.
 */

/** Distinct tag ids present across the given items (order-independent). */
export function collectPresentTagIds(
  items: readonly { tagIds?: readonly string[] }[],
): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    for (const id of item.tagIds ?? []) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * Keeps rows carrying at least one selected tag; an empty selection is a no-op.
 * Group-header rows survive only when at least one of their items does.
 */
export function filterTableRowsByTags(
  rows: readonly TableRowItem[],
  selectedTagIds: ReadonlySet<string>,
): TableRowItem[] {
  if (selectedTagIds.size === 0) return [...rows];

  const result: TableRowItem[] = [];
  let currentHeader: TableRowItem | undefined;
  let matchingGroupItems: TableRowItem[] = [];

  const flushGroup = () => {
    if (!currentHeader || matchingGroupItems.length === 0) return;
    if (!isGroupHeaderRow(currentHeader)) return;
    result.push(
      {
        ...currentHeader,
        metadata: {
          ...currentHeader.metadata,
          itemCount: matchingGroupItems.length,
        },
      },
      ...matchingGroupItems,
    );
  };

  for (const row of rows) {
    if (isGroupHeaderRow(row)) {
      flushGroup();
      currentHeader = row;
      matchingGroupItems = [];
      continue;
    }

    const matches = (row.data.tagIds ?? []).some((id) =>
      selectedTagIds.has(id),
    );
    if (!matches) continue;
    if (currentHeader) matchingGroupItems.push(row);
    else result.push(row);
  }
  flushGroup();

  return result;
}
