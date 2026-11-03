import type { SupportedCurrency } from 'pulpe-shared';

export const EXCHANGE_RATE_PORT = Symbol('EXCHANGE_RATE_PORT');

export interface ExchangeRatePort {
  /**
   * Today's rate: how many `target` one unit of `base` is worth. Throws when
   * no rate is available.
   */
  getRate(base: SupportedCurrency, target: SupportedCurrency): Promise<number>;
}
