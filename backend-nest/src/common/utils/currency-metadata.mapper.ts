import { type SupportedCurrency, supportedCurrencySchema } from 'pulpe-shared';

interface DecryptedCurrencyMetadataDbRow {
  original_amount?: number | null;
  original_currency?: string | null;
  target_currency?: string | null;
  exchange_rate?: number | null;
}

interface CurrencyMetadataApi {
  originalAmount?: number;
  originalCurrency?: SupportedCurrency;
  targetCurrency?: SupportedCurrency;
  exchangeRate?: number;
}

export function parseCurrency(
  value: string | null | undefined,
): SupportedCurrency | undefined {
  if (!value) return undefined;
  const result = supportedCurrencySchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function mapCurrencyMetadataToApi(
  row: DecryptedCurrencyMetadataDbRow,
): CurrencyMetadataApi {
  return {
    originalAmount: row.original_amount ?? undefined,
    originalCurrency: parseCurrency(row.original_currency),
    targetCurrency: parseCurrency(row.target_currency),
    exchangeRate: row.exchange_rate ?? undefined,
  };
}

interface CurrencyNonAmountMetadataDto {
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  originalAmount?: never;
}

interface CurrencyMetadataDbColumns {
  original_amount: string | null;
  original_currency: string | null;
  target_currency: string | null;
  exchange_rate: number | null;
}

type CurrencyNonAmountDbColumns = Omit<
  CurrencyMetadataDbColumns,
  'original_amount'
>;

/**
 * Maps non-amount currency metadata DTO fields to their DB column names.
 *
 * `original_amount` is intentionally excluded because it is ciphertext. Callers
 * must encrypt `originalAmount` separately with ENCRYPTION_PORT.encryptOptionalAmount.
 *
 * Returns only the keys that are explicitly defined in the input DTO — so
 * spreading the result onto a PATCH update object never clobbers untouched
 * columns. Missing keys are omitted; explicit `null` / `undefined` values
 * normalize to `null` for the columns the caller did mention.
 */
export function mapCurrencyNonAmountMetadataToDb(
  dto: CurrencyNonAmountMetadataDto,
): Partial<CurrencyNonAmountDbColumns> {
  if ('originalAmount' in dto) {
    throw new Error(
      'originalAmount must be encrypted separately with encryptOptionalAmount',
    );
  }

  const out: Partial<CurrencyNonAmountDbColumns> = {};
  if (dto.originalCurrency !== undefined) {
    out.original_currency = dto.originalCurrency ?? null;
  }
  if (dto.targetCurrency !== undefined) {
    out.target_currency = dto.targetCurrency ?? null;
  }
  if (dto.exchangeRate !== undefined) {
    out.exchange_rate = dto.exchangeRate ?? null;
  }
  return out;
}
