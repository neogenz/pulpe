import { describe, it, expect } from 'vitest';
import { mergeToggleStates } from './toggle-updaters';

interface TestItem {
  id: string;
  name: string;
  checkedAt: string | null;
}

describe('mergeToggleStates', () => {
  it('preserves checkedAt from latestItems for matching IDs', () => {
    const items: TestItem[] = [
      { id: '1', name: 'Item 1', checkedAt: null },
      { id: '2', name: 'Item 2', checkedAt: '2024-01-01' },
    ];
    const latestItems: TestItem[] = [
      { id: '1', name: 'Item 1', checkedAt: '2024-01-02' },
      { id: '2', name: 'Item 2', checkedAt: null },
    ];

    const result = mergeToggleStates(items, latestItems);

    expect(result[0].checkedAt).toBe('2024-01-02');
    expect(result[1].checkedAt).toBe(null);
  });

  it('handles items not found in latestItems (keeps original)', () => {
    const items: TestItem[] = [
      { id: '1', name: 'Item 1', checkedAt: '2024-01-01' },
      { id: '2', name: 'Item 2', checkedAt: null },
    ];
    const latestItems: TestItem[] = [
      { id: '1', name: 'Item 1', checkedAt: '2024-01-02' },
    ];

    const result = mergeToggleStates(items, latestItems);

    expect(result[0].checkedAt).toBe('2024-01-02');
    expect(result[1].checkedAt).toBe(null);
  });

  it('handles empty latestItems', () => {
    const items: TestItem[] = [
      { id: '1', name: 'Item 1', checkedAt: '2024-01-01' },
      { id: '2', name: 'Item 2', checkedAt: null },
    ];
    const latestItems: TestItem[] = [];

    const result = mergeToggleStates(items, latestItems);

    expect(result).toEqual(items);
  });

  it('handles empty items', () => {
    const items: TestItem[] = [];
    const latestItems: TestItem[] = [
      { id: '1', name: 'Item 1', checkedAt: '2024-01-01' },
    ];

    const result = mergeToggleStates(items, latestItems);

    expect(result).toEqual([]);
  });

  it('merges concurrent toggle: item checked in latest, mutation result unchecked -> should use latest', () => {
    const items: TestItem[] = [{ id: '1', name: 'Item 1', checkedAt: null }];
    const latestItems: TestItem[] = [
      { id: '1', name: 'Item 1', checkedAt: '2024-01-02' },
    ];

    const result = mergeToggleStates(items, latestItems);

    expect(result[0].checkedAt).toBe('2024-01-02');
  });

  it('does NOT change non-checkedAt fields', () => {
    const items: TestItem[] = [
      { id: '1', name: 'Updated Name', checkedAt: null },
    ];
    const latestItems: TestItem[] = [
      { id: '1', name: 'Original Name', checkedAt: '2024-01-02' },
    ];

    const result = mergeToggleStates(items, latestItems);

    expect(result[0].name).toBe('Updated Name');
    expect(result[0].checkedAt).toBe('2024-01-02');
  });
});
