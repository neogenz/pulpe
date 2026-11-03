import { inject, Service } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  FEATURE_FLAGS,
  type Asset,
  type NetWorth,
  type SupportedCurrency,
} from 'pulpe-shared';
import { firstValueFrom, map } from 'rxjs';

import { PostHogService } from '@core/analytics/posthog';
import { AssetApi, NET_WORTH_CACHE_KEY } from '@core/asset/asset-api';
import {
  ReconcileAccountsDialog,
  type ReconcileAccountsDialogData,
} from './reconcile-accounts-dialog';

@Service()
export class ReconcileAccountsDialogService {
  readonly #dialog = inject(MatDialog);
  readonly #assetApi = inject(AssetApi);
  readonly #postHog = inject(PostHogService);
  #isOpening = false;

  // The same dialog at every width — only its frame changes. On a phone it
  // takes the whole height: three steps of fields would not fit a centred card
  // above a keyboard.
  //
  // The linked accounts are read before the dialog exists, because it builds
  // its rows once: rows arriving after opening would overwrite what the user
  // already typed. With the flag off no request is made and the dialog opens
  // at once, on one empty row.
  async open(
    data: Omit<ReconcileAccountsDialogData, 'linkedAccounts'>,
    isHandset: boolean,
  ): Promise<void> {
    if (this.#isOpening) return;
    this.#isOpening = true;
    try {
      const linkedAccounts = this.#postHog.isFeatureEnabled(
        FEATURE_FLAGS.NET_WORTH,
      )
        ? await this.#readLinkedAccounts(data.currency())
        : [];
      this.#dialog.open<ReconcileAccountsDialog, ReconcileAccountsDialogData>(
        ReconcileAccountsDialog,
        {
          data: { ...data, linkedAccounts },
          autoFocus: '[inputmode="decimal"]',
          disableClose: true,
          ...(isHandset
            ? {
                panelClass: 'full-screen-dialog',
                width: '100dvw',
                maxWidth: '100dvw',
                height: '100dvh',
                maxHeight: '100dvh',
              }
            : { width: '560px', maxWidth: 'calc(100vw - 48px)' }),
        },
      );
    } finally {
      this.#isOpening = false;
    }
  }

  // A failed read is already reported by the HTTP interceptor; the user loses
  // only the pre-filled rows and reconciles as before.
  async #readLinkedAccounts(currency: SupportedCurrency): Promise<Asset[]> {
    try {
      const cache = this.#assetApi.cache;
      if (!cache.get<NetWorth>(NET_WORTH_CACHE_KEY)?.fresh) {
        await cache.prefetch(NET_WORTH_CACHE_KEY, () =>
          firstValueFrom(
            this.#assetApi
              .getNetWorth$()
              .pipe(map((response) => response.data)),
          ),
        );
      }
      const netWorth = cache.get<NetWorth>(NET_WORTH_CACHE_KEY)?.data;
      return (netWorth?.assets ?? []).filter(
        (asset) =>
          asset.direction === 'own' &&
          asset.inPulpe &&
          asset.archivedAt === null &&
          asset.currency === currency,
      );
    } catch {
      return [];
    }
  }
}
