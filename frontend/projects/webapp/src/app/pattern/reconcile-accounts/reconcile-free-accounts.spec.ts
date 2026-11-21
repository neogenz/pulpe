import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { STORAGE_KEYS, StorageService } from '@core/storage';
import { readFreeAccounts, saveFreeAccounts } from './reconcile-free-accounts';

describe('reconcile free accounts memory', () => {
  let storage: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    storage = TestBed.inject(StorageService);
  });

  it('should bring back names and sides, trimmed, without blank names', () => {
    saveFreeAccounts(storage, [
      { name: ' Revolut ', side: 'own' },
      { name: 'Klarna', side: 'owe' },
      { name: '  ', side: 'own' },
    ]);

    expect(readFreeAccounts(storage)).toEqual([
      { name: 'Revolut', side: 'own' },
      { name: 'Klarna', side: 'owe' },
    ]);
  });

  it('should never write an amount to the device', () => {
    saveFreeAccounts(storage, [
      { name: 'Revolut', side: 'own', amountText: '1000' } as never,
    ]);

    expect(
      localStorage.getItem(STORAGE_KEYS.RECONCILE_FREE_ACCOUNTS),
    ).not.toContain('1000');
  });

  it('should start empty when nothing valid is stored', () => {
    localStorage.setItem(
      STORAGE_KEYS.RECONCILE_FREE_ACCOUNTS,
      JSON.stringify({
        version: 1,
        data: [{ name: 'X', side: 'maybe' }],
        updatedAt: new Date().toISOString(),
      }),
    );

    expect(readFreeAccounts(storage)).toEqual([]);
  });

  it('should be cleared on sign-out', () => {
    saveFreeAccounts(storage, [{ name: 'Revolut', side: 'own' }]);

    storage.clearAllUserData();

    expect(readFreeAccounts(storage)).toEqual([]);
  });
});
