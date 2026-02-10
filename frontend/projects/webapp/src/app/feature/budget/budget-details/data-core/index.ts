// Models
export type {
  TableItem,
  TableItemDisplayMetadata,
  BudgetLineConsumptionDisplay,
  BudgetLineTableItem,
  TransactionTableItem,
  GroupHeaderTableItem,
  TableRowItem,
} from './budget-item-models';

// Constants and helpers
export {
  KIND_ICONS,
  ALLOCATION_LABELS,
  TRANSACTION_COUNT_LABELS,
  GROUP_LABELS,
  RECURRENCE_ORDER,
  KIND_ORDER,
  getKindIcon,
  getAllocationLabel,
  getTransactionCountLabel,
  calculatePercentage,
  getRolloverSourceBudgetId,
  getSignedAmount,
  safeParseDate,
  formatMatchAnnotation,
  normalizeText,
} from './budget-item-constants';

// View mode type
export type { BudgetViewMode } from './budget-view-mode';

// Data builder
export { buildViewData } from './budget-item-data-builder';

// Data provider service
export { BudgetItemDataProvider } from './budget-item-data-provider';
