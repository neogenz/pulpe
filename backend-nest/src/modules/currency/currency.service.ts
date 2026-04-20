import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { formatBusinessCalendarDate } from '@common/utils/business-calendar-date';
import { supportedCurrencySchema, type SupportedCurrency } from 'pulpe-shared';
import { z } from 'zod';

type FxCarrier = {
  originalAmount?: number | null;
  originalCurrency?: string;
  targetCurrency?: string;
  exchangeRate?: number | null;
};

const fxOverrideSchema = z
  .object({
    originalAmount: z.number().nullable().optional(),
    originalCurrency: z.string().optional(),
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

    if (sameCurrency || missingCurrencyPair) {
      // No valid conversion context → drop any client-supplied FX metadata
      // (defence-in-depth against forged payloads). Keys absent from the
      // original DTO stay absent, preserving PATCH semantics.
      // Same-currency case also strips originalCurrency/targetCurrency per
      // PUL-99 CA7 ("même devise → aucune métadonnée stockée").
      const preservedFx: FxCarrier = {};
      if (!sameCurrency) {
        if ('originalCurrency' in fxFields) {
          preservedFx.originalCurrency = fxFields.originalCurrency;
        }
        if ('targetCurrency' in fxFields) {
          preservedFx.targetCurrency = fxFields.targetCurrency;
        }
      }
      return { ...rest, ...preservedFx } as T;
    }

    const baseResult = supportedCurrencySchema.safeParse(
      fxFields.originalCurrency,
    );
    const targetResult = supportedCurrencySchema.safeParse(
      fxFields.targetCurrency,
    );

    if (!baseResult.success || !targetResult.success) {
      throw new BusinessException(
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        {
          reason: `Unsupported currency: ${!baseResult.success ? fxFields.originalCurrency : fxFields.targetCurrency}`,
        },
        { operation: 'overrideExchangeRate' },
      );
    }

    const { rate } = await this.getRate(baseResult.data, targetResult.data);
    return {
      ...rest,
      originalAmount: fxFields.originalAmount,
      originalCurrency: fxFields.originalCurrency,
      targetCurrency: fxFields.targetCurrency,
      exchangeRate: rate,
    } as T;
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
