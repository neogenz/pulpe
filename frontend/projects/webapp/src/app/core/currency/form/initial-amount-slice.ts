import type { SupportedCurrency } from 'pulpe-shared';

import { type AmountFormSlice, createAmountSlice } from './amount-form.types';

export interface InitialAmountSliceArgs {
  readonly isPickerVisible: boolean;
  readonly originalAmount: number | null | undefined;
  readonly originalCurrency: SupportedCurrency | null | undefined;
  readonly fallbackAmount: number;
  readonly userCurrency: SupportedCurrency;
}

export function createInitialAmountSlice(
  args: InitialAmountSliceArgs,
): AmountFormSlice {
  if (
    args.isPickerVisible &&
    args.originalAmount != null &&
    args.originalCurrency != null
  ) {
    return createAmountSlice({
      initialCurrency: args.originalCurrency,
      initialAmount: args.originalAmount,
    });
  }
  return createAmountSlice({
    initialCurrency: args.userCurrency,
    initialAmount: args.fallbackAmount,
  });
}
