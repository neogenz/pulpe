import type { SupportedCurrency } from 'pulpe-shared';

import type { Logger } from '@core/logging/logger';

import type { CurrencyConverterService } from '../conversion/currency-converter.service';
import type { CurrencyMetadata } from '../conversion/currency.types';
import { type AmountFormSlice, isAmountSliceFilled } from './amount-form.types';

/**
 * Outcome of a form submit that depends on currency conversion.
 *
 * - `ok`: conversion + build succeeded; `value` is the caller-built result.
 *   `rateInfo` exposes freshness when the rate fetch fell back to a stale
 *   cache entry, so callers can surface a warning before persisting.
 * - `invalid`: amount slice was empty (defensive — `submit()` should gate)
 * - `failed-conversion`: converter threw; error already logged
 * - `failed-build`: build callback threw (e.g., schema parse failure); error already logged
 */
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

/**
 * Convert the slice amount to `targetCurrency`, then run `build` to produce
 * the caller's DTO.
 *
 * Errors are split into two outcomes so callers can distinguish a real
 * conversion failure (network/rate provider) from a build-time failure
 * (schema parse, malformed payload). UX should surface them differently.
 *
 * Designed to be called inside an `async` action passed to
 * `submit()` from `@angular/forms/signals` — the form-level `valid()` gate
 * and field touch-marking are owned by `submit()`.
 */
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
