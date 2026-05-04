import type { SupportedCurrency } from 'pulpe-shared';

export interface PickerVisibilityArgs {
  isMultiCurrencyEnabled: boolean;
  originalCurrency: SupportedCurrency | null;
  userCurrency: SupportedCurrency;
}

/**
 * Whether the currency picker should be shown for an existing entity (edit
 * mode) — only when the multi-currency flag is on and the original currency
 * differs from the user's display currency.
 */
export function isCurrencyPickerVisible(args: PickerVisibilityArgs): boolean {
  return (
    args.isMultiCurrencyEnabled &&
    args.originalCurrency !== null &&
    args.originalCurrency !== args.userCurrency
  );
}
