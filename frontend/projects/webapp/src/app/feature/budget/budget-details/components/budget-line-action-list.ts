import type { BudgetLineTableItem } from '../view-models/table-items.view-model';

/** Shared eligibility rules for action menus whose items must stay in the host view. */
export function isSpreadUnavailableForRecurringLine(
  item: BudgetLineTableItem,
): boolean {
  return (
    !item.metadata.canSpread &&
    item.data.recurrence === 'fixed' &&
    item.data.kind !== 'income'
  );
}

export function isPostponeUnavailableForRecurringLine(
  item: BudgetLineTableItem,
): boolean {
  return (
    !item.metadata.showPostpone &&
    item.data.recurrence === 'fixed' &&
    item.data.kind !== 'income'
  );
}
