import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { UserSettingsStore } from './user-settings-store';
import { UserSettingsApi } from './user-settings-api';
import { AuthStateService } from '../auth/auth-state.service';
import { ClientKeyService } from '../encryption/client-key.service';
import { DemoModeService } from '../demo/demo-mode.service';
import type { UserSettings } from 'pulpe-shared';

const mockCache = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  has: vi.fn().mockReturnValue(false),
  invalidate: vi.fn(),
  deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  prefetch: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  clear: vi.fn(),
  clearDirty: vi.fn(),
  version: signal(0),
};

describe('UserSettingsStore', () => {
  let store: UserSettingsStore;
  let mockApi: Partial<UserSettingsApi>;

  const mockSettings: UserSettings = { payDayOfMonth: 25 };

  beforeEach(() => {
    mockCache.get.mockReturnValue(null);
    mockCache.set.mockClear();

    mockApi = {
      getSettings$: vi
        .fn()
        .mockReturnValue(of({ data: mockSettings, success: true })),
      updateSettings$: vi.fn(),
      deleteAccount: vi.fn(),
      cache: mockCache as unknown as UserSettingsApi['cache'],
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        UserSettingsStore,
        { provide: UserSettingsApi, useValue: mockApi },
        {
          provide: AuthStateService,
          useValue: { isAuthenticated: signal(true) },
        },
        {
          provide: ClientKeyService,
          useValue: { hasClientKey: signal(true) },
        },
        {
          provide: DemoModeService,
          useValue: { isDemoMode: signal(false) },
        },
      ],
    });

    store = TestBed.inject(UserSettingsStore);
  });

  describe('Error propagation', () => {
    it('should expose the error via error() when the loader fails', async () => {
      mockApi.getSettings$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Network failure')));

      store = TestBed.inject(UserSettingsStore);
      store.reload();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.error()).toBeTruthy();
      expect(store.error()).toBeInstanceOf(Error);
      expect((store.error() as Error).message).toBe('Network failure');
    });

    it('should not have settings data when loader fails without prior cache', async () => {
      mockApi.getSettings$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Server error')));

      store = TestBed.inject(UserSettingsStore);
      store.reload();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.settings()).toBeUndefined();
      expect(store.error()).toBeTruthy();
    });
  });

  describe('Successful load', () => {
    it('should load settings and expose them via settings()', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.settings()).toEqual(mockSettings);
      expect(store.payDayOfMonth()).toBe(25);
      expect(store.error()).toBeUndefined();
    });
  });
});
