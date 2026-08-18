import * as z from 'zod';
import { supportedCurrencySchema } from 'pulpe-shared';

export const conversionFormSchema = z.strictObject({
  originalAmount: z.number().positive(),
  originalCurrency: supportedCurrencySchema,
  targetCurrency: supportedCurrencySchema,
  exchangeRate: z.number().positive(),
});

export type ConversionFormValue = z.input<typeof conversionFormSchema>;
