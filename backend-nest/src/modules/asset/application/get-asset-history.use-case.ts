import { Inject, Injectable } from '@nestjs/common';
import type { AssetHistoryQuery } from 'pulpe-shared';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
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
import {
  assetHistory,
  computeNetWorth,
  historyRank,
} from '../domain/asset.formulas';
import type {
  AssetHistoryEntry,
  AssetHistoryPage,
  AssetWithValue,
} from '../domain/asset.entity';

@Injectable()
export class GetAssetHistoryUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly repo: AssetRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: UserRepositoryPort,
    @Inject(EXCHANGE_RATE_PORT)
    private readonly exchangeRates: ExchangeRatePort,
    @InjectInfoLogger(GetAssetHistoryUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  /**
   * The asset valued as on `GET /v1/assets` and one page of its history, both
   * computed from the same read. An archived or unknown asset has no detail.
   */
  async execute(
    id: string,
    query: AssetHistoryQuery,
    user: AuthenticatedUser,
  ): Promise<AssetHistoryPage> {
    const [assets, settings, snapshots] = await Promise.all([
      this.repo.findAllWithLatestValue(),
      this.userRepo.findSettings(),
      this.repo.findSnapshots(id),
    ]);
    const asset = assets.find(
      (candidate) => candidate.id === id && candidate.archivedAt === null,
    );
    if (!asset) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ASSET_NOT_FOUND,
        { id },
        { operation: 'assetHistory.get', userId: user.id, entityId: id },
      );
    }

    const baseCurrency = settings.currency;
    const [movements, rate] = await Promise.all([
      this.repo.findMovementsSince(
        snapshots.at(0)?.recordedAt ?? asset.latestRecordedAt,
        id,
      ),
      asset.currency === baseCurrency
        ? 1
        : this.rateOf(asset, baseCurrency, user),
    ]);

    const [valued] = computeNetWorth({
      baseCurrency,
      categories: [],
      assets: [asset],
      rates: rate === undefined ? {} : { [asset.currency]: rate },
      movements,
    }).assets;
    return {
      asset: valued,
      ...pageOf(assetHistory(asset, snapshots, movements, rate), query),
    };
  }

  private async rateOf(
    asset: AssetWithValue,
    baseCurrency: AssetWithValue['currency'],
    user: AuthenticatedUser,
  ): Promise<number | undefined> {
    try {
      return await this.exchangeRates.getRate(asset.currency, baseCurrency);
    } catch (error) {
      // No rate: the value stays the last entry and the effects are null.
      this.logger.warn(
        {
          operation: 'assetHistory.get',
          userId: user.id,
          currency: asset.currency,
          err: error,
        },
        'Exchange rate unavailable, asset history without effects',
      );
      return undefined;
    }
  }
}

/**
 * The entries after `cursor` (the last entry of the previous page), so a page
 * never shifts when an entry is added on top meanwhile.
 *
 * shortcut: the whole history of the asset is decrypted and computed for every
 * page, since a debt's floor depends on everything before it in its period;
 * move the keyset into SQL once one asset holds thousands of entries.
 */
function pageOf(
  entries: AssetHistoryEntry[],
  { limit, cursor }: AssetHistoryQuery,
): Pick<AssetHistoryPage, 'entries' | 'nextCursor'> {
  let start = 0;
  if (cursor !== undefined) {
    const [at, rank, id] = cursor.split('.');
    const after = entries.findIndex((entry) => {
      const key = historyRank(entry);
      return (
        key.at < Number(at) ||
        (key.at === Number(at) &&
          (key.rank > Number(rank) ||
            (key.rank === Number(rank) && key.id > id)))
      );
    });
    start = after === -1 ? entries.length : after;
  }

  const page = entries.slice(start, start + limit);
  const last = page.at(-1);
  return {
    entries: page,
    nextCursor: last && start + limit < entries.length ? cursorOf(last) : null,
  };
}

function cursorOf(entry: AssetHistoryEntry): string {
  const { at, rank, id } = historyRank(entry);
  return `${at}.${rank}.${id}`;
}
