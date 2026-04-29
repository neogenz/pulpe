export { AppCurrencyPipe } from './app-currency.pipe';
export { CURRENCY_CONFIG, DEFAULT_DIGITS_INFO } from './currency-config';

export { FormatConversionPipe } from './conversion/format-conversion.pipe';
export { CurrencyConverterService } from './conversion/currency-converter.service';
export {
  injectLiveConversionPreview,
  type LivePreviewState,
  type LivePreviewStatus,
} from './conversion/live-conversion-preview';
export type {
  CurrencyMetadata,
  CurrencyConversionResult,
  FetchRateResult,
} from './conversion/currency.types';

export {
  conversionFormSchema,
  type ConversionFormValue,
} from './form/conversion-form.schema';
export {
  type AmountFormSlice,
  type CreateAmountSliceArgs,
  createAmountSlice,
} from './form/amount-form.types';
export { applyAmountValidators } from './form/amount-form-validators';
