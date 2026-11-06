import { Inject, Injectable } from '@nestjs/common';
import type { SupportedCurrency } from 'pulpe-shared';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '@modules/user/domain/ports/user-repository.port';
import {
  ASSET_REPOSITORY,
  type AssetRepositoryPort,
} from '../domain/ports/asset-repository.port';
import {
  EXCHANGE_RATE_PORT,
  type ExchangeRatePort,
} from '../domain/ports/exchange-rate.port';
import { checkedLinesCutoffs, computeNetWorth } from '../domain/asset.formulas';
import type { NetWorth } from '../domain/asset.entity';

@Injectable()
export class GetNetWorthUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly repo: AssetRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: UserRepositoryPort,
    @Inject(EXCHANGE_RATE_PORT)
    private readonly exchangeRates: ExchangeRatePort,
    @InjectInfoLogger(GetNetWorthUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(user: AuthenticatedUser): Promise<NetWorth> {
    const [categories, assets, settings] = await Promise.all([
      this.repo.findAllCategories(),
      this.repo.findAllWithLatestValue(),
      this.userRepo.findSettings(),
    ]);
    const baseCurrency = settings.currency;

    const checkedLines = await this.repo.findCheckedLinkedLines(
      checkedLinesCutoffs(assets),
    );

    const foreignCurrencies = [
      ...new Set(assets.map((asset) => asset.currency)),
    ].filter((currency) => currency !== baseCurrency);
    const rates: Partial<Record<SupportedCurrency, number>> = {};
    await Promise.all(
      foreignCurrencies.map(async (currency) => {
        try {
          rates[currency] = await this.exchangeRates.getRate(
            currency,
            baseCurrency,
          );
        } catch (error) {
          // No rate: the formula leaves these assets out and flags `incomplete`.
          this.logger.warn(
            {
              operation: 'netWorth.get',
              userId: user.id,
              currency,
              err: error,
            },
            'Exchange rate unavailable, net worth is incomplete',
          );
        }
      }),
    );

    return computeNetWorth({
      baseCurrency,
      categories,
      assets,
      rates,
      checkedLines,
    });
  }
}
