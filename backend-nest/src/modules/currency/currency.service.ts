import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { formatBusinessCalendarDate } from '@common/utils/business-calendar-date';
import { supportedCurrencySchema, type SupportedCurrency } from 'pulpe-shared';

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

  async overrideExchangeRate<
    T extends {
      originalAmount?: number | null;
      originalCurrency?: string;
      targetCurrency?: string;
      exchangeRate?: number | null;
    },
  >(dto: T): Promise<T> {
    const sameCurrency =
      !!dto.originalCurrency &&
      !!dto.targetCurrency &&
      dto.originalCurrency === dto.targetCurrency;
    const missingCurrencyPair = !dto.originalCurrency || !dto.targetCurrency;

    if (sameCurrency || missingCurrencyPair) {
      // No valid conversion context → drop any client-supplied FX metadata
      // (defence-in-depth against forged payloads). Keys absent from the
      // original DTO stay absent, preserving PATCH semantics.
      // Same-currency case also strips originalCurrency/targetCurrency per
      // PUL-99 CA7 ("même devise → aucune métadonnée stockée").
      const sanitized: Record<string, unknown> = { ...dto };
      delete sanitized.exchangeRate;
      delete sanitized.originalAmount;
      if (sameCurrency) {
        delete sanitized.originalCurrency;
        delete sanitized.targetCurrency;
      }
      return sanitized as T;
    }

    const baseResult = supportedCurrencySchema.safeParse(dto.originalCurrency);
    const targetResult = supportedCurrencySchema.safeParse(dto.targetCurrency);

    if (!baseResult.success || !targetResult.success) {
      throw new BusinessException(
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        {
          reason: `Unsupported currency: ${!baseResult.success ? dto.originalCurrency : dto.targetCurrency}`,
        },
        { operation: 'overrideExchangeRate' },
      );
    }

    const { rate } = await this.getRate(baseResult.data, targetResult.data);
    return { ...dto, exchangeRate: rate };
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
