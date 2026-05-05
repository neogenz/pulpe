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

/**
 * Type predicate: narrows `AmountFormSlice` to its non-null variant once
 * `applyAmountValidators` has marked the form valid. Use at submit boundaries
 * to drop the non-null assertion (`!`) on `amount`.
 */
export function isAmountSliceFilled(
  slice: AmountFormSlice,
): slice is AmountFormSlice & { amount: number } {
  return slice.amount !== null;
}
