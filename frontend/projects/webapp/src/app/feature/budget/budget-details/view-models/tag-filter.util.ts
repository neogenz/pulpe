import {
  isGroupHeaderRow,
  type GroupHeaderTableItem,
  type TableRowItem,
} from './table-items.view-model';

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
 * A budget line also matches when one of its allocated transactions carries a
 * selected tag. Group headers survive only when at least one item does.
 */
export function filterTableRowsByTags(
  rows: readonly TableRowItem[],
  selectedTagIds: ReadonlySet<string>,
  transactions: readonly {
    budgetLineId?: string | null;
    tagIds?: readonly string[];
  }[] = [],
): TableRowItem[] {
  if (selectedTagIds.size === 0) return [...rows];

  const parentIdsWithSelectedTags = new Set<string>();
  for (const transaction of transactions) {
    const parentId = transaction.budgetLineId;
    if (
      parentId &&
      (transaction.tagIds ?? []).some((id) => selectedTagIds.has(id))
    ) {
      parentIdsWithSelectedTags.add(parentId);
    }
  }

  const result: TableRowItem[] = [];
  let currentHeader: GroupHeaderTableItem | undefined;
  let matchingGroupItems: TableRowItem[] = [];

  const flushGroup = () => {
    if (!currentHeader || matchingGroupItems.length === 0) return;
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

    const matches =
      (row.data.tagIds ?? []).some((id) => selectedTagIds.has(id)) ||
      (row.metadata.itemType === 'budget_line' &&
        parentIdsWithSelectedTags.has(row.data.id));
    if (!matches) continue;
    if (currentHeader) matchingGroupItems.push(row);
    else result.push(row);
  }
  flushGroup();

  return result;
}
