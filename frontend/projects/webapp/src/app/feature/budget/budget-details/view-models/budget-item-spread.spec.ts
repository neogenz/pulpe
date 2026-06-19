import { describe, expect, it } from 'vitest';
import { createMockBudgetLine } from '@app/testing/mock-factories';
import { buildViewData } from './budget-item-data-builder';
import type { BudgetLineTableItem } from './table-items.view-model';

/**
 * PUL-17 Lot B — `isSpread` flag precomputation in the view-model builder.
 * The flag drives the "Lissé" pill; it MUST be derived from `spreadGroupId`
 * in the builder, never recomputed in templates.
 */
describe('budget-item-data-builder — spread flag (PUL-17 Lot B)', () => {
  function findLine(
    items: ReturnType<typeof buildViewData>,
    id: string,
  ): BudgetLineTableItem {
    const item = items.find(
      (i) =>
        'data' in i &&
        i.metadata.itemType === 'budget_line' &&
        i.data.id === id,
    );
    return item as BudgetLineTableItem;
  }

  it('should mark a line as spread when spreadGroupId is set', () => {
    const line = createMockBudgetLine({
      id: 'line-spread',
      spreadGroupId: '11111111-1111-1111-1111-111111111111',
    });

    const result = buildViewData({ budgetLines: [line], transactions: [] });

    const vm = findLine(result, 'line-spread');
    expect(vm.metadata.isSpread).toBe(true);
    expect(vm.metadata.spreadGroupId).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
  });

  it('should NOT mark a line as spread when spreadGroupId is null', () => {
    const line = createMockBudgetLine({
      id: 'line-plain',
      spreadGroupId: null,
    });

    const result = buildViewData({ budgetLines: [line], transactions: [] });

    const vm = findLine(result, 'line-plain');
    expect(vm.metadata.isSpread).toBe(false);
    expect(vm.metadata.spreadGroupId).toBeNull();
  });

  it('should NOT mark a line as spread when spreadGroupId is absent', () => {
    const line = createMockBudgetLine({ id: 'line-absent' });

    const result = buildViewData({ budgetLines: [line], transactions: [] });

    const vm = findLine(result, 'line-absent');
    expect(vm.metadata.isSpread).toBe(false);
    expect(vm.metadata.spreadGroupId).toBeNull();
  });
});
