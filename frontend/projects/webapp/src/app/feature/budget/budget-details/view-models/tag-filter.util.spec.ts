import { describe, it, expect } from 'vitest';
import {
  createMockBudgetLine,
  createMockTransaction,
} from '@app/testing/mock-factories';
import { collectPresentTagIds, filterTableRowsByTags } from './tag-filter.util';
import type {
  BudgetLineTableItem,
  GroupHeaderTableItem,
  TableRowItem,
} from './table-items.view-model';

function lineRow(id: string, tagIds: string[]): BudgetLineTableItem {
  return {
    data: createMockBudgetLine({ id, tagIds }),
    metadata: {
      itemType: 'budget_line',
      cumulativeBalance: 0,
      kindIcon: 'circle',
      allocationLabel: 'Ajouter',
      displayName: id,
    },
  };
}

function groupHeader(
  groupKind: 'income' | 'expense' | 'saving',
  itemCount = 1,
): GroupHeaderTableItem {
  return {
    metadata: {
      itemType: 'group_header',
      groupKind,
      groupLabel: groupKind,
      groupIcon: 'folder',
      itemCount,
    },
  };
}

describe('collectPresentTagIds', () => {
  it('should union the tag ids across all items', () => {
    const ids = collectPresentTagIds([
      createMockBudgetLine({ tagIds: ['a', 'b'] }),
      createMockTransaction({ tagIds: ['b', 'c'] }),
    ]);

    expect([...ids].sort()).toEqual(['a', 'b', 'c']);
  });

  it('should return an empty set when no item carries a tag', () => {
    const ids = collectPresentTagIds([createMockBudgetLine({ tagIds: [] })]);

    expect(ids.size).toBe(0);
  });
});

describe('filterTableRowsByTags', () => {
  it('should return the rows untouched when no tag is selected', () => {
    const rows: TableRowItem[] = [groupHeader('expense'), lineRow('l1', ['a'])];

    expect(filterTableRowsByTags(rows, new Set())).toEqual(rows);
  });

  it('should keep only rows carrying a selected tag and drop emptied group headers', () => {
    const rows: TableRowItem[] = [
      groupHeader('income'),
      lineRow('inc', ['x']),
      groupHeader('expense'),
      lineRow('exp', ['y']),
    ];

    const result = filterTableRowsByTags(rows, new Set(['x']));

    expect(result).toHaveLength(2);
    expect(result[0].metadata.itemType).toBe('group_header');
    expect((result[0] as GroupHeaderTableItem).metadata.groupKind).toBe(
      'income',
    );
    expect((result[1] as BudgetLineTableItem).data.id).toBe('inc');
  });

  it('should keep an item matching at least one of its several tags', () => {
    const rows: TableRowItem[] = [
      groupHeader('expense'),
      lineRow('multi', ['a', 'b']),
    ];

    const result = filterTableRowsByTags(rows, new Set(['b']));

    expect(result).toHaveLength(2);
  });

  it('should recompute the visible item count and remove empty groups', () => {
    const rows: TableRowItem[] = [
      groupHeader('expense', 3),
      lineRow('food', ['a']),
      lineRow('home', ['a', 'b']),
      lineRow('travel', ['c']),
      groupHeader('saving', 1),
      lineRow('emergency', ['c']),
    ];

    const result = filterTableRowsByTags(rows, new Set(['a']));

    expect(result).toHaveLength(3);
    expect((result[0] as GroupHeaderTableItem).metadata).toMatchObject({
      groupKind: 'expense',
      itemCount: 2,
    });
    expect(result.map((row) => row.metadata.itemType)).toEqual([
      'group_header',
      'budget_line',
      'budget_line',
    ]);
  });
});
