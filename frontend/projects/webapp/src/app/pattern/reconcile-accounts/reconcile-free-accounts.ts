import {
  STORAGE_KEYS,
  type FreeAccount,
  type StorageService,
} from '@core/storage';

/** Names and sides only: what saves typing next time, never an amount. */
export function readFreeAccounts(storage: StorageService): FreeAccount[] {
  return storage.get<FreeAccount[]>(STORAGE_KEYS.RECONCILE_FREE_ACCOUNTS) ?? [];
}

export function saveFreeAccounts(
  storage: StorageService,
  accounts: readonly { name: string; side: FreeAccount['side'] }[],
): void {
  const named = accounts
    .map(({ name, side }) => ({ name: name.trim(), side }))
    .filter(({ name }) => name !== '');
  storage.set(STORAGE_KEYS.RECONCILE_FREE_ACCOUNTS, named);
}
