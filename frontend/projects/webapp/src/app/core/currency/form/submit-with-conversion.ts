import type { SupportedCurrency } from 'pulpe-shared';

import type { Logger } from '@core/logging/logger';

import type { CurrencyConverterService } from '../conversion/currency-converter.service';
import type { CurrencyMetadata } from '../conversion/currency.types';
import { type AmountFormSlice, isAmountSliceFilled } from './amount-form.types';

// `failed-conversion` = converter threw. `failed-build` = build callback threw (e.g., schema parse). Split so UX can distinguish.
export interface ConversionRateInfo {
  readonly cachedDate?: string;
  readonly fromFallback?: boolean;
}

export type SubmitWithConversionOutcome<TResult> =
  | {
      readonly status: 'ok';
      readonly value: TResult;
      readonly rateInfo?: ConversionRateInfo;
    }
  | { readonly status: 'invalid' }
  | { readonly status: 'failed-conversion' }
  | { readonly status: 'failed-build' };

export interface SubmitWithConversionArgs<TResult> {
  readonly amountSlice: AmountFormSlice;
  readonly targetCurrency: SupportedCurrency;
  readonly converter: CurrencyConverterService;
  readonly logger: Logger;
  readonly build: (
    convertedAmount: number,
    metadata: CurrencyMetadata | null,
  ) => TResult;
}

export async function submitWithConversion<TResult>(
  args: SubmitWithConversionArgs<TResult>,
): Promise<SubmitWithConversionOutcome<TResult>> {
  if (!isAmountSliceFilled(args.amountSlice)) {
    return { status: 'invalid' };
  }
  let convertedAmount: number;
  let metadata: CurrencyMetadata | null;
  let rateInfo: ConversionRateInfo | undefined;
  try {
    const result = await args.converter.convertWithMetadata(
      args.amountSlice.amount,
      args.amountSlice.inputCurrency,
      args.targetCurrency,
    );
    convertedAmount = result.convertedAmount;
    metadata = result.metadata;
    if (result.fromFallback || result.cachedDate) {
      rateInfo = {
        cachedDate: result.cachedDate,
        fromFallback: result.fromFallback,
      };
    }
    if (result.fromFallback) {
      args.logger.warn('Currency conversion used stale fallback rate', {
        cachedDate: result.cachedDate,
        inputCurrency: args.amountSlice.inputCurrency,
        targetCurrency: args.targetCurrency,
      });
    }
  } catch (error: unknown) {
    args.logger.error('Currency conversion failed', error);
    return { status: 'failed-conversion' };
  }
  try {
    return {
      status: 'ok',
      value: args.build(convertedAmount, metadata),
      rateInfo,
    };
  } catch (error: unknown) {
    args.logger.error(
      'Form submit build failed after successful conversion',
      error,
    );
    return { status: 'failed-build' };
  }
}
