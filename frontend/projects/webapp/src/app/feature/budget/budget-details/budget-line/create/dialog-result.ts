import type { BudgetLineCreate, BudgetLineSpreadCreate } from 'pulpe-shared';

/**
 * Discriminated result of the add-forecast dialog (PUL-17).
 * `single` → one budget line in the current month.
 * `spread` → N independent `one_off` lines fanned out across the picked months.
 */
export type AddBudgetLineDialogResult =
  | { readonly mode: 'single'; readonly value: BudgetLineCreate }
  | { readonly mode: 'spread'; readonly value: BudgetLineSpreadCreate };
