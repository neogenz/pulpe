import type { SupportedCurrency } from 'pulpe-shared';

/**
 * Composite form slice for "amount + input currency" entry.
 * Used as a sub-slice of any signal-forms model that needs amount + currency.
 */
export interface AmountFormSlice {
  amount: number | null;
  inputCurrency: SupportedCurrency;
}

export interface CreateAmountSliceArgs {
  readonly initialCurrency: SupportedCurrency;
  readonly initialAmount?: number | null;
}

export function createAmountSlice(
  args: CreateAmountSliceArgs,
): AmountFormSlice {
  return {
    amount: args.initialAmount ?? null,
    inputCurrency: args.initialCurrency,
  };
}
