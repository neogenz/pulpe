import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { supportedCurrencySchema, type SupportedCurrency } from 'pulpe-shared';

interface CachedRate {
  rate: number;
  date: string;
  expiresAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CurrencyService {
  readonly #cache = new Map<string, CachedRate>();

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
        rate: 1,
        date: new Date().toISOString().slice(0, 10),
      };
    }

    const cacheKey = `${base}_${target}`;
    const cached = this.#cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return { base, target, rate: cached.rate, date: cached.date };
    }

    return this.#fetchAndCache(base, target, cacheKey);
  }

  async overrideExchangeRate<
    T extends {
      originalCurrency?: string;
      targetCurrency?: string;
      exchangeRate?: number | null;
    },
  >(dto: T): Promise<T> {
    if (
      !dto.originalCurrency ||
      !dto.targetCurrency ||
      dto.originalCurrency === dto.targetCurrency
    ) {
      return dto;
    }

    const baseResult = supportedCurrencySchema.safeParse(dto.originalCurrency);
    const targetResult = supportedCurrencySchema.safeParse(dto.targetCurrency);

    if (!baseResult.success || !targetResult.success) {
      throw new BusinessException(
        ERROR_DEFINITIONS.CURRENCY_RATE_FETCH_FAILED,
        { base: dto.originalCurrency, target: dto.targetCurrency },
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

    if (rate === undefined) {
      throw new BusinessException(
        ERROR_DEFINITIONS.CURRENCY_RATE_FETCH_FAILED,
        { base, target },
        { operation: 'getRate' },
      );
    }

    return { rate, date: data.date ?? new Date().toISOString().slice(0, 10) };
  }
}
