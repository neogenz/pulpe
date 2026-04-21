import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { formatBusinessCalendarDate } from '@common/utils/business-calendar-date';
import { parseCurrency } from '@common/utils/currency-metadata.mapper';
import { type SupportedCurrency } from 'pulpe-shared';
import { z } from 'zod';

type FxCarrier = {
  originalAmount?: number | null;
  originalCurrency?: string | null;
  targetCurrency?: string;
  exchangeRate?: number | null;
};

const FX_SOURCE_KEYS = [
  'originalAmount',
  'originalCurrency',
  'exchangeRate',
] as const satisfies readonly (keyof FxCarrier)[];

const fxOverrideSchema = z
  .object({
    originalAmount: z.number().nullable().optional(),
    originalCurrency: z.string().nullable().optional(),
    targetCurrency: z.string().optional(),
    exchangeRate: z.number().nullable().optional(),
  })
  .strict();

interface CachedRate {
  rate: number;
  date: string;
  expiresAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const IDENTITY_EXCHANGE_RATE = 1;

@Injectable()
export class CurrencyService {
  readonly #cache = new Map<string, CachedRate>();
  readonly #inFlight = new Map<
    string,
    Promise<{
      base: SupportedCurrency;
      target: SupportedCurrency;
      rate: number;
      date: string;
    }>
  >();

  constructor(
    @InjectInfoLogger(CurrencyService.name)
    private readonly logger: InfoLogger,
  ) {}

  async getRate(
    base: SupportedCurrency,
    target: SupportedCurrency,
  ): Promise<{
    base: SupportedCurrency;
    target: SupportedCurrency;
    rate: number;
    date: string;
  }> {
    if (base === target) {
      return {
        base,
        target,
        rate: IDENTITY_EXCHANGE_RATE,
        date: formatBusinessCalendarDate(),
      };
    }

    const cacheKey = `${base}_${target}`;
    const cached = this.#cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return { base, target, rate: cached.rate, date: cached.date };
    }

    const existing = this.#inFlight.get(cacheKey);
    if (existing) {
      try {
        return await existing;
      } catch (error) {
        return this.#rateWhenFetchFails(base, target, cached, error);
      }
    }

    const promise = this.#fetchAndCache(base, target, cacheKey).finally(() => {
      this.#inFlight.delete(cacheKey);
    });
    this.#inFlight.set(cacheKey, promise);

    try {
      return await promise;
    } catch (error) {
      return this.#rateWhenFetchFails(base, target, cached, error);
    }
  }

  #rateWhenFetchFails(
    base: SupportedCurrency,
    target: SupportedCurrency,
    cached: CachedRate | undefined,
    error: unknown,
  ): {
    base: SupportedCurrency;
    target: SupportedCurrency;
    rate: number;
    date: string;
  } {
    if (cached) {
      this.logger.warn(
        { operation: 'getRate', base, target, cachedDate: cached.date },
        'Currency API unavailable, returning stale cached rate',
      );
      return { base, target, rate: cached.rate, date: cached.date };
    }
    this.#logRateUnavailableNoCache(base, target, error);
    throw new BusinessException(
      ERROR_DEFINITIONS.CURRENCY_RATE_FETCH_FAILED,
      { base, target },
      { operation: 'getRate' },
      { cause: error instanceof Error ? error : undefined },
    );
  }

  #logRateUnavailableNoCache(
    base: SupportedCurrency,
    target: SupportedCurrency,
    error: unknown,
  ): void {
    const logContext: Record<string, unknown> = {
      operation: 'getRate',
      base,
      target,
    };
    if (error instanceof Error) {
      logContext.err = error;
    }
    this.logger.warn(
      logContext,
      'Currency API unavailable and no cached rate, rejecting request',
    );
  }

  async overrideExchangeRate<T extends FxCarrier>(dto: T): Promise<T> {
    const { fxFields, rest } = this.#splitAndValidateFx(dto);

    const sameCurrency =
      !!fxFields.originalCurrency &&
      !!fxFields.targetCurrency &&
      fxFields.originalCurrency === fxFields.targetCurrency;
    const missingCurrencyPair =
      !fxFields.originalCurrency || !fxFields.targetCurrency;

    if (sameCurrency) {
      // Defence-in-depth: a bogus equal pair (e.g. "ZZZ"/"ZZZ") that bypasses
      // DTO validation would wipe persisted FX columns via the destructive
      // null-clear. Reject unsupported currencies first. PUL-115 + RG-009.
      if (!parseCurrency(fxFields.originalCurrency)) {
        throw new BusinessException(
          ERROR_DEFINITIONS.VALIDATION_FAILED,
          { reason: `Unsupported currency: ${fxFields.originalCurrency}` },
          { operation: 'overrideExchangeRate' },
        );
      }
      return { ...rest, ...this.#buildSameCurrencyFx(fxFields) } as T;
    }

    if (missingCurrencyPair) {
      return { ...rest, ...this.#buildMissingPairFx(fxFields) } as T;
    }

    const { base, target } = this.#parseCurrencyPair(
      fxFields.originalCurrency,
      fxFields.targetCurrency,
    );
    const { rate } = await this.getRate(base, target);
    return {
      ...rest,
      originalAmount: fxFields.originalAmount,
      originalCurrency: fxFields.originalCurrency,
      targetCurrency: fxFields.targetCurrency,
      exchangeRate: rate,
    } as T;
  }

  // Same-currency case: force-null the 3 source FX fields so any pre-existing
  // orphan metadata in DB gets cleared. targetCurrency (budget display currency)
  // is preserved as-is from the client input.
  #buildSameCurrencyFx(fxFields: FxCarrier): FxCarrier {
    const preservedFx: FxCarrier = {
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
    };
    if ('targetCurrency' in fxFields) {
      preservedFx.targetCurrency = fxFields.targetCurrency;
    }
    return preservedFx;
  }

  // Incomplete conversion context → drop forged FX values (defence-in-depth).
  // If any FX source key was sent by the client (originalAmount, originalCurrency,
  // exchangeRate), force-null all three so the row can never violate the
  // fx_metadata_coherent CHECK constraint. Clients that did not touch FX at all
  // leave the columns untouched, preserving PATCH semantics.
  #buildMissingPairFx(fxFields: FxCarrier): FxCarrier {
    const touchesSourceFx = FX_SOURCE_KEYS.some((k) => k in fxFields);

    const preservedFx: FxCarrier = {};
    if (touchesSourceFx) {
      preservedFx.originalAmount = null;
      preservedFx.originalCurrency = null;
      preservedFx.exchangeRate = null;
    }
    if ('targetCurrency' in fxFields) {
      preservedFx.targetCurrency = fxFields.targetCurrency;
    }
    return preservedFx;
  }

  #parseCurrencyPair(
    original: string | null | undefined,
    target: string | undefined,
  ): { base: SupportedCurrency; target: SupportedCurrency } {
    const base = parseCurrency(original);
    const parsedTarget = parseCurrency(target);

    if (!base || !parsedTarget) {
      throw new BusinessException(
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        { reason: `Unsupported currency: ${!base ? original : target}` },
        { operation: 'overrideExchangeRate' },
      );
    }

    return { base, target: parsedTarget };
  }

  #splitAndValidateFx<T extends FxCarrier>(
    dto: T,
  ): { fxFields: FxCarrier; rest: Omit<T, keyof FxCarrier> } {
    const {
      originalAmount,
      originalCurrency,
      targetCurrency,
      exchangeRate,
      ...rest
    } = dto;

    const fxSubset: Record<string, unknown> = {};
    if (originalAmount !== undefined) fxSubset.originalAmount = originalAmount;
    if (originalCurrency !== undefined)
      fxSubset.originalCurrency = originalCurrency;
    if (targetCurrency !== undefined) fxSubset.targetCurrency = targetCurrency;
    if (exchangeRate !== undefined) fxSubset.exchangeRate = exchangeRate;

    const parsed = fxOverrideSchema.safeParse(fxSubset);
    if (!parsed.success) {
      throw new BusinessException(
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        { reason: `Invalid FX metadata: ${parsed.error.message}` },
        { operation: 'overrideExchangeRate' },
      );
    }

    return { fxFields: parsed.data, rest };
  }

  async #fetchAndCache(
    base: SupportedCurrency,
    target: SupportedCurrency,
    cacheKey: string,
  ) {
    const { rate, date } = await this.#fetchRate(base, target);

    this.#cache.set(cacheKey, {
      rate,
      date,
      expiresAt: Date.now() + TTL_MS,
    });

    this.logger.info(
      { operation: 'getRate', base, target, rate },
      'Currency rate fetched and cached',
    );

    return { base, target, rate, date };
  }

  async #fetchRate(
    base: SupportedCurrency,
    target: SupportedCurrency,
  ): Promise<{ rate: number; date: string }> {
    const url = `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${target}`;

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    } catch (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.CURRENCY_RATE_FETCH_FAILED,
        { base, target },
        { operation: 'getRate' },
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new BusinessException(
        ERROR_DEFINITIONS.CURRENCY_RATE_FETCH_FAILED,
        { base, target },
        { operation: 'getRate', statusCode: response.status },
      );
    }

    const data = (await response.json()) as {
      rates?: Record<string, number>;
      date?: string;
    };
    const rate = data.rates?.[target];

    if (rate === undefined || !Number.isFinite(rate) || rate <= 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.CURRENCY_RATE_FETCH_FAILED,
        { base, target },
        { operation: 'getRate', receivedRate: rate },
      );
    }

    return { rate, date: data.date ?? formatBusinessCalendarDate() };
  }
}
