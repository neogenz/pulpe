import type { SupportedCurrency } from 'pulpe-shared';

export interface PickerVisibilityArgs {
  originalCurrency: SupportedCurrency | null;
  userCurrency: SupportedCurrency;
}

/**
 * Whether the currency picker should be shown for an existing entity (edit
 * mode) — only when the original currency differs from the user's display
 * currency.
 */
export function isCurrencyPickerVisible(args: PickerVisibilityArgs): boolean {
  return (
    args.originalCurrency !== null &&
    args.originalCurrency !== args.userCurrency
  );
}
