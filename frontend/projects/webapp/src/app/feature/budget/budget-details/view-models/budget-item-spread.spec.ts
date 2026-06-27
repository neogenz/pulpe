import { describe, expect, it } from 'vitest';
import {
  createMockBudgetLine,
  createMockTransaction,
} from '@app/testing/mock-factories';
import { buildViewData } from './budget-item-data-builder';
import type {
  BudgetLineTableItem,
  TransactionTableItem,
} from './table-items.view-model';

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

/**
 * PUL-17 v1.1 — `canSpread` flag precomputation. It gates the "Lisser" action.
 * Asserted against the REAL builder (`buildViewData`), never hand-mocked
 * metadata, so the matrix stays coupled to the production rule.
 */
describe('budget-item-data-builder — canSpread flag (PUL-17 v1.1)', () => {
  function findLine(
    items: ReturnType<typeof buildViewData>,
    id: string,
  ): BudgetLineTableItem {
    return items.find(
      (i) =>
        'data' in i &&
        i.metadata.itemType === 'budget_line' &&
        i.data.id === id,
    ) as BudgetLineTableItem;
  }

  function findTransaction(
    items: ReturnType<typeof buildViewData>,
    id: string,
  ): TransactionTableItem | undefined {
    return items.find(
      (i) =>
        'data' in i &&
        i.metadata.itemType === 'transaction' &&
        i.data.id === id,
    ) as TransactionTableItem | undefined;
  }

  describe('budget_line source', () => {
    it('should allow spreading a one_off non-income not-already-spread positive line', () => {
      const line = createMockBudgetLine({
        id: 'spreadable',
        recurrence: 'one_off',
        kind: 'expense',
        amount: 1200,
        spreadGroupId: null,
      });

      const result = buildViewData({ budgetLines: [line], transactions: [] });

      expect(findLine(result, 'spreadable').metadata.canSpread).toBe(true);
    });

    it('should NOT allow spreading an income line', () => {
      const line = createMockBudgetLine({
        id: 'income-line',
        recurrence: 'one_off',
        kind: 'income',
        amount: 1200,
      });

      const result = buildViewData({ budgetLines: [line], transactions: [] });

      expect(findLine(result, 'income-line').metadata.canSpread).toBe(false);
    });

    it('should NOT allow spreading a recurrent (fixed) line', () => {
      const line = createMockBudgetLine({
        id: 'fixed-line',
        recurrence: 'fixed',
        kind: 'expense',
        amount: 1200,
      });

      const result = buildViewData({ budgetLines: [line], transactions: [] });

      expect(findLine(result, 'fixed-line').metadata.canSpread).toBe(false);
    });

    it('should NOT allow spreading an already-spread line (spreadGroupId set)', () => {
      const line = createMockBudgetLine({
        id: 'already-spread',
        recurrence: 'one_off',
        kind: 'expense',
        amount: 1200,
        spreadGroupId: '11111111-1111-1111-1111-111111111111',
      });

      const result = buildViewData({ budgetLines: [line], transactions: [] });

      expect(findLine(result, 'already-spread').metadata.canSpread).toBe(false);
    });

    it('should NOT allow spreading a line with a non-positive amount', () => {
      const line = createMockBudgetLine({
        id: 'zero-line',
        recurrence: 'one_off',
        kind: 'expense',
        amount: 0,
      });

      const result = buildViewData({ budgetLines: [line], transactions: [] });

      expect(findLine(result, 'zero-line').metadata.canSpread).toBe(false);
    });
  });

  describe('transaction source', () => {
    it('should allow spreading a free non-income positive transaction', () => {
      const transaction = createMockTransaction({
        id: 'free-txn',
        budgetLineId: null,
        kind: 'expense',
        amount: 800,
      });

      const result = buildViewData({
        budgetLines: [],
        transactions: [transaction],
      });

      expect(findTransaction(result, 'free-txn')?.metadata.canSpread).toBe(
        true,
      );
    });

    it('should NOT allow spreading a free income transaction', () => {
      const transaction = createMockTransaction({
        id: 'free-income-txn',
        budgetLineId: null,
        kind: 'income',
        amount: 800,
      });

      const result = buildViewData({
        budgetLines: [],
        transactions: [transaction],
      });

      expect(
        findTransaction(result, 'free-income-txn')?.metadata.canSpread,
      ).toBe(false);
    });

    it('should NOT allow spreading a free transaction with a non-positive amount', () => {
      const transaction = createMockTransaction({
        id: 'free-zero-txn',
        budgetLineId: null,
        kind: 'expense',
        amount: 0,
      });

      const result = buildViewData({
        budgetLines: [],
        transactions: [transaction],
      });

      expect(findTransaction(result, 'free-zero-txn')?.metadata.canSpread).toBe(
        false,
      );
    });

    it('should not surface an allocated transaction as a top-level spreadable row', () => {
      // Allocated txns derive their spread from the parent envelope line; the
      // builder filters them out of the top-level list entirely, so no "Lisser"
      // action is ever offered on the transaction itself.
      const line = createMockBudgetLine({
        id: 'parent-line',
        recurrence: 'one_off',
        kind: 'expense',
        amount: 1000,
      });
      const allocated = createMockTransaction({
        id: 'allocated-txn',
        budgetLineId: 'parent-line',
        kind: 'expense',
        amount: 400,
      });

      const result = buildViewData({
        budgetLines: [line],
        transactions: [allocated],
      });

      expect(findTransaction(result, 'allocated-txn')).toBeUndefined();
    });
  });
});
