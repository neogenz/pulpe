import { type ResourceRef, type Signal, computed } from '@angular/core';
import { createRolloverLine } from '@core/rollover/rollover-types';
import {
  type BudgetLine,
  type Transaction,
  BudgetFormulas,
} from 'pulpe-shared';
import { type BudgetDetailsViewModel } from '../models/budget-details-view-model';

export interface BudgetDetailsSelectorContext {
  readonly budgetDetailsResource: ResourceRef<
    BudgetDetailsViewModel | undefined
  >;
  readonly budgetDetails: Signal<BudgetDetailsViewModel | null>;
  readonly rolloverCheckedAt: Signal<string | null>;
  readonly isShowingOnlyUnchecked: Signal<boolean>;
}

export function createDisplayBudgetLines(
  ctx: BudgetDetailsSelectorContext,
): Signal<BudgetLine[]> {
  return computed(() => {
    const details = ctx.budgetDetails();
    if (!details) return [];

    const lines = [...details.budgetLines];
    const rollover = details.rollover;

    if (rollover !== 0 && rollover !== undefined) {
      const rolloverLine = createRolloverLine({
        budgetId: details.id,
        amount: rollover,
        month: details.month,
        year: details.year,
        previousBudgetId: details.previousBudgetId,
      });
      rolloverLine.checkedAt = ctx.rolloverCheckedAt();
      lines.unshift(rolloverLine);
    }

    return lines;
  });
}

export function createRealizedBalance(
  ctx: BudgetDetailsSelectorContext,
  displayBudgetLines: Signal<BudgetLine[]>,
): Signal<number> {
  return computed(() => {
    if (!ctx.budgetDetailsResource.hasValue()) return 0;
    const details = ctx.budgetDetailsResource.value()!;
    return BudgetFormulas.calculateRealizedBalance(
      displayBudgetLines(),
      details.transactions,
    );
  });
}

export function createRealizedExpenses(
  ctx: BudgetDetailsSelectorContext,
  displayBudgetLines: Signal<BudgetLine[]>,
): Signal<number> {
  return computed(() => {
    if (!ctx.budgetDetailsResource.hasValue()) return 0;
    const details = ctx.budgetDetailsResource.value()!;
    return BudgetFormulas.calculateRealizedExpenses(
      displayBudgetLines(),
      details.transactions,
    );
  });
}

export function createCheckedItemsCount(
  ctx: BudgetDetailsSelectorContext,
  displayBudgetLines: Signal<BudgetLine[]>,
): Signal<number> {
  return computed(() => {
    if (!ctx.budgetDetailsResource.hasValue()) return 0;
    const details = ctx.budgetDetailsResource.value()!;
    const lines = displayBudgetLines();
    const transactions = details.transactions ?? [];
    return [...lines, ...transactions].filter((item) => item.checkedAt != null)
      .length;
  });
}

export function createTotalItemsCount(
  ctx: BudgetDetailsSelectorContext,
  displayBudgetLines: Signal<BudgetLine[]>,
): Signal<number> {
  return computed(() => {
    if (!ctx.budgetDetailsResource.hasValue()) return 0;
    const details = ctx.budgetDetailsResource.value()!;
    const lines = displayBudgetLines();
    const transactions = details.transactions ?? [];
    return lines.length + transactions.length;
  });
}

export function createFilteredBudgetLines(
  displayBudgetLines: Signal<BudgetLine[]>,
  isShowingOnlyUnchecked: Signal<boolean>,
): Signal<BudgetLine[]> {
  return computed(() => {
    const lines = displayBudgetLines();
    if (!isShowingOnlyUnchecked()) return lines;
    return lines.filter((line) => line.checkedAt === null);
  });
}

export function createFilteredTransactions(
  ctx: BudgetDetailsSelectorContext,
  filteredBudgetLines: Signal<BudgetLine[]>,
): Signal<Transaction[]> {
  return computed(() => {
    const details = ctx.budgetDetails();
    if (!details) return [];

    const transactions = details.transactions ?? [];
    if (!ctx.isShowingOnlyUnchecked()) return transactions;

    const visibleBudgetLineIds = new Set(
      filteredBudgetLines().map((line) => line.id),
    );

    return transactions.filter((tx) => {
      if (tx.budgetLineId) return visibleBudgetLineIds.has(tx.budgetLineId);
      return tx.checkedAt === null;
    });
  });
}
