import { type SupportedCurrency, supportedCurrencySchema } from 'pulpe-shared';

interface CurrencyMetadataDbRow {
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

function parseCurrency(
  value: string | null | undefined,
): SupportedCurrency | undefined {
  if (!value) return undefined;
  const result = supportedCurrencySchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function mapCurrencyMetadataToApi(
  row: CurrencyMetadataDbRow,
): CurrencyMetadataApi {
  return {
    originalAmount: row.original_amount ?? undefined,
    originalCurrency: parseCurrency(row.original_currency),
    targetCurrency: parseCurrency(row.target_currency),
    exchangeRate: row.exchange_rate ?? undefined,
  };
}

interface CurrencyMetadataDto {
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
}

interface CurrencyMetadataDb {
  original_currency: string | null;
  target_currency: string | null;
  exchange_rate: number | null;
}

export function mapCurrencyMetadataToDb(
  dto: CurrencyMetadataDto,
): CurrencyMetadataDb {
  return {
    original_currency: dto.originalCurrency ?? null,
    target_currency: dto.targetCurrency ?? null,
    exchange_rate: dto.exchangeRate ?? null,
  };
}
