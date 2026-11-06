import { inject } from '@angular/core';
import { cachedResource } from 'ngx-ziflux';
import { map, type Observable } from 'rxjs';
import type { AssetDirection, NetWorth, TransactionKind } from 'pulpe-shared';

import { AssetApi, NET_WORTH_CACHE_KEY } from './asset-api';

/**
 * Which assets a prévision of this kind can be linked to: an Épargne lands on
 * something I own, a Dépense repays something I owe. A Revenu has no field of
 * its own: it only gets the picker through its origin « Tiré de mon patrimoine »
 * (`kind="income"`, `direction="own"`). Mirrors the `asset_id` guard trigger,
 * which refuses any other pairing.
 */
export function assetDirectionForKind(
  kind: TransactionKind,
): AssetDirection | null {
  if (kind === 'saving') return 'own';
  if (kind === 'expense') return 'owe';
  return null;
}

/** The payload every `NET_WORTH_CACHE_KEY` reader stores. */
export function loadNetWorth(api: AssetApi): Observable<NetWorth> {
  return api.getNetWorth$().pipe(map((response) => response.data));
}

/**
 * The net-worth read the page, the picker and the prévision dialogs share: one
 * key, one loader, one request. Call it from an injection context.
 */
export function injectNetWorthResource() {
  const api = inject(AssetApi);
  return cachedResource({
    cache: api.cache,
    cacheKey: NET_WORTH_CACHE_KEY,
    loader: () => loadNetWorth(api),
  });
}
