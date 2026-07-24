import type {
  BudgetLineCreate,
  BudgetLineSpreadCreate,
  SupportedCurrency,
} from 'pulpe-shared';

/**
 * Discriminated result of the add-forecast dialog (PUL-17, PUL-292).
 * `single` → one budget line in the current month.
 * `spread` → N independent `one_off` lines, one per picked month.
 * `savingsWithdrawal` → the income "remise le mois prochain" toggle was ON, or
 *   the saving-kind "piocher dans mon épargne" shortcut was clicked: the caller
 *   opens the withdrawal dialog, at its preview step when a prefill is carried
 *   (no prefill → the dialog starts at its amount step). Carries
 *   `inputCurrency` so an amount typed in a foreign currency is not re-read as
 *   the user's currency by the withdrawal dialog.
 */
export type AddBudgetLineDialogResult =
  | { readonly mode: 'single'; readonly value: BudgetLineCreate }
  | { readonly mode: 'spread'; readonly value: BudgetLineSpreadCreate }
  | {
      readonly mode: 'savingsWithdrawal';
      readonly prefill?: {
        readonly amount: number;
        readonly source: string;
        readonly inputCurrency: SupportedCurrency;
      };
    };
