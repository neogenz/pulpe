import { Injectable } from '@nestjs/common';
import type { SupportedCurrency } from 'pulpe-shared';
import { CurrencyService } from '@modules/currency/currency.service';
import type { ExchangeRatePort } from '../../domain/ports/exchange-rate.port';

/** The only file of the asset module that knows the currency module. */
@Injectable()
export class CurrencyExchangeRateAdapter implements ExchangeRatePort {
  constructor(private readonly currencyService: CurrencyService) {}

  async getRate(
    base: SupportedCurrency,
    target: SupportedCurrency,
  ): Promise<number> {
    const { rate } = await this.currencyService.getRate(base, target);
    return rate;
  }
}
