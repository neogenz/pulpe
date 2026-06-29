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
 * PUL-22 — postpone ("Reporter au mois suivant") visibility + disabled-reason
 * precomputation in the view-model builder. Asserted against the REAL builder
 * (`buildViewData`) so the matrix stays coupled to the production rule.
 *
 * Three outcomes per item:
 *  - hidden          → `showPostpone === false`
 *  - shown enabled   → `showPostpone === true`, `postponeDisabledReason === null`
 *  - shown disabled  → `showPostpone === true`, `postponeDisabledReason === '<key>'`
 *
 * The disabled-reason is a transloco key, so the dumb menu components resolve it
 * via the `transloco` pipe (the `{ month }` param is ignored by the pointed key).
 */
const CHECKED_KEY = 'budget.postponeUnavailableChecked';
const NO_NEXT_MONTH_KEY = 'budget.postponeDisabledTooltip';
const NEXT_MONTH_READY = {
  hasNextMonthBudget: true,
  nextMonthLabel: 'juillet',
};

function findLine(
  items: ReturnType<typeof buildViewData>,
  id: string,
): BudgetLineTableItem {
  return items.find(
    (i) =>
      'data' in i && i.metadata.itemType === 'budget_line' && i.data.id === id,
  ) as BudgetLineTableItem;
}

function findTransaction(
  items: ReturnType<typeof buildViewData>,
  id: string,
): TransactionTableItem {
  return items.find(
    (i) =>
      'data' in i && i.metadata.itemType === 'transaction' && i.data.id === id,
  ) as TransactionTableItem;
}

describe('budget-item-data-builder — postpone (PUL-22) — budget lines', () => {
  it('should enable postpone for an unchecked one-off line when next month exists', () => {
    const line = createMockBudgetLine({
      id: 'enabled',
      recurrence: 'one_off',
      checkedAt: null,
    });

    const result = buildViewData({
      budgetLines: [line],
      transactions: [],
      postpone: NEXT_MONTH_READY,
    });

    const vm = findLine(result, 'enabled');
    expect(vm.metadata.showPostpone).toBe(true);
    expect(vm.metadata.isPostponeDisabled).toBe(false);
    expect(vm.metadata.postponeDisabledReason).toBeNull();
  });

  it('should show a pointed line disabled with the "checked" reason instead of hiding it', () => {
    const line = createMockBudgetLine({
      id: 'pointed',
      recurrence: 'one_off',
      checkedAt: '2026-06-15T10:00:00Z',
    });

    const result = buildViewData({
      budgetLines: [line],
      transactions: [],
      postpone: NEXT_MONTH_READY,
    });

    const vm = findLine(result, 'pointed');
    expect(vm.metadata.showPostpone).toBe(true);
    expect(vm.metadata.isPostponeDisabled).toBe(true);
    expect(vm.metadata.postponeDisabledReason).toBe(CHECKED_KEY);
  });

  it('should show an unchecked line disabled with the CA5 reason when next month is missing', () => {
    const line = createMockBudgetLine({
      id: 'no-next-month',
      recurrence: 'one_off',
      checkedAt: null,
    });

    // No `postpone` arg → hasNextMonthBudget defaults to false (CA5).
    const result = buildViewData({ budgetLines: [line], transactions: [] });

    const vm = findLine(result, 'no-next-month');
    expect(vm.metadata.showPostpone).toBe(true);
    expect(vm.metadata.isPostponeDisabled).toBe(true);
    expect(vm.metadata.postponeDisabledReason).toBe(NO_NEXT_MONTH_KEY);
  });

  it('should prefer the "checked" reason over CA5 when a line is both pointed and has no next-month budget', () => {
    const line = createMockBudgetLine({
      id: 'pointed-no-next-month',
      recurrence: 'one_off',
      checkedAt: '2026-06-15T10:00:00Z',
    });

    const result = buildViewData({ budgetLines: [line], transactions: [] });

    expect(
      findLine(result, 'pointed-no-next-month').metadata.postponeDisabledReason,
    ).toBe(CHECKED_KEY);
  });

  it('should hide postpone entirely for a recurrent (fixed) line', () => {
    const line = createMockBudgetLine({
      id: 'recurrent',
      recurrence: 'fixed',
      checkedAt: null,
    });

    const result = buildViewData({
      budgetLines: [line],
      transactions: [],
      postpone: NEXT_MONTH_READY,
    });

    expect(findLine(result, 'recurrent').metadata.showPostpone).toBe(false);
  });

  it('should hide postpone entirely for a line with allocated transactions', () => {
    const line = createMockBudgetLine({
      id: 'consumed',
      recurrence: 'one_off',
      checkedAt: null,
    });
    const allocated = createMockTransaction({
      id: 'alloc',
      budgetLineId: 'consumed',
    });

    const result = buildViewData({
      budgetLines: [line],
      transactions: [allocated],
      postpone: NEXT_MONTH_READY,
    });

    expect(findLine(result, 'consumed').metadata.showPostpone).toBe(false);
  });
});

describe('budget-item-data-builder — postpone (PUL-22) — free transactions', () => {
  it('should enable postpone for an unchecked free transaction when next month exists', () => {
    const transaction = createMockTransaction({
      id: 'free-enabled',
      budgetLineId: null,
      checkedAt: null,
    });

    const result = buildViewData({
      budgetLines: [],
      transactions: [transaction],
      postpone: NEXT_MONTH_READY,
    });

    const vm = findTransaction(result, 'free-enabled');
    expect(vm.metadata.showPostpone).toBe(true);
    expect(vm.metadata.isPostponeDisabled).toBe(false);
    expect(vm.metadata.postponeDisabledReason).toBeNull();
  });

  it('should show a pointed free transaction disabled with the "checked" reason', () => {
    const transaction = createMockTransaction({
      id: 'free-pointed',
      budgetLineId: null,
      checkedAt: '2026-06-15T10:00:00Z',
    });

    const result = buildViewData({
      budgetLines: [],
      transactions: [transaction],
      postpone: NEXT_MONTH_READY,
    });

    const vm = findTransaction(result, 'free-pointed');
    expect(vm.metadata.showPostpone).toBe(true);
    expect(vm.metadata.isPostponeDisabled).toBe(true);
    expect(vm.metadata.postponeDisabledReason).toBe(CHECKED_KEY);
  });

  it('should show an unchecked free transaction disabled with the CA5 reason when next month is missing', () => {
    const transaction = createMockTransaction({
      id: 'free-no-next-month',
      budgetLineId: null,
      checkedAt: null,
    });

    const result = buildViewData({
      budgetLines: [],
      transactions: [transaction],
    });

    expect(
      findTransaction(result, 'free-no-next-month').metadata
        .postponeDisabledReason,
    ).toBe(NO_NEXT_MONTH_KEY);
  });
});
