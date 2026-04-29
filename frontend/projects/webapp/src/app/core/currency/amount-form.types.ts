import type { SupportedCurrency } from 'pulpe-shared';

/**
 * Composite form slice for "amount + input currency" entry.
 * Used as a sub-slice of any signal-forms model that needs amount + currency.
 *
 * `amount` is always a `number`. The "empty" state is represented by `NaN`
 * so the signal-forms `[field]` directive can use `valueAsNumber` on
 * `<input type="number">` (it only does so when `typeof value === 'number'`).
 * `NaN` renders as an empty input and is treated as empty by `required`/`min`.
 */
export interface AmountFormSlice {
  amount: number;
  inputCurrency: SupportedCurrency;
}

export interface CreateAmountSliceArgs {
  readonly initialCurrency: SupportedCurrency;
  readonly initialAmount?: number | null;
}

export function createAmountSlice(
  args: CreateAmountSliceArgs,
): AmountFormSlice {
  const initial = args.initialAmount;
  return {
    amount: initial == null ? Number.NaN : initial,
    inputCurrency: args.initialCurrency,
  };
}
