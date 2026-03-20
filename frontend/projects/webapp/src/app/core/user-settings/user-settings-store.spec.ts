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
    mockCache.clear.mockClear();

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

      await vi.waitFor(() => {
        expect(store.error()).toBeTruthy();
        expect(store.error()).toBeInstanceOf(Error);
        expect((store.error() as Error).message).toBe('Network failure');
      });
    });

    it('should not have settings data when loader fails without prior cache', async () => {
      mockApi.getSettings$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Server error')));

      store = TestBed.inject(UserSettingsStore);
      store.reload();

      await vi.waitFor(() => {
        expect(store.settings()).toBeUndefined();
        expect(store.error()).toBeTruthy();
      });
    });
  });

  describe('Successful load', () => {
    it('should load settings and expose them via settings()', async () => {
      await vi.waitFor(() => {
        expect(store.settings()).toEqual(mockSettings);
        expect(store.payDayOfMonth()).toBe(25);
        expect(store.error()).toBeUndefined();
      });
    });
  });

  describe('updateSettings', () => {
    it('should call API and return updated settings', async () => {
      const updated: UserSettings = { payDayOfMonth: 15 };
      mockApi.updateSettings$ = vi
        .fn()
        .mockReturnValue(of({ data: updated, success: true }));

      const result = await store.updateSettings({ payDayOfMonth: 15 });

      expect(result).toEqual(updated);
      expect(mockApi.updateSettings$).toHaveBeenCalledWith({
        payDayOfMonth: 15,
      });
    });

    it('should update local settings signal after API call', async () => {
      const updated: UserSettings = { payDayOfMonth: 15 };
      mockApi.updateSettings$ = vi
        .fn()
        .mockReturnValue(of({ data: updated, success: true }));

      await store.updateSettings({ payDayOfMonth: 15 });

      expect(store.settings()).toEqual(updated);
      expect(store.payDayOfMonth()).toBe(15);
    });
  });

  describe('deleteAccount', () => {
    it('should call API deleteAccount', async () => {
      mockApi.deleteAccount = vi.fn().mockResolvedValue({ success: true });

      await store.deleteAccount();

      expect(mockApi.deleteAccount).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should clear the API cache', () => {
      store.reset();
      expect(mockCache.clear).toHaveBeenCalled();
    });
  });

  describe('reload', () => {
    it('should trigger a fresh load from API', async () => {
      await vi.waitFor(() => {
        expect(store.settings()).toEqual(mockSettings);
      });

      const newSettings: UserSettings = { payDayOfMonth: 10 };
      mockApi.getSettings$ = vi
        .fn()
        .mockReturnValue(of({ data: newSettings, success: true }));

      store.reload();

      await vi.waitFor(() => {
        expect(store.settings()).toEqual(newSettings);
      });
    });
  });
});

describe('UserSettingsStore — loading conditions', () => {
  beforeEach(() => {
    mockCache.get.mockReturnValue(null);
    mockCache.set.mockClear();
  });

  it('should not load settings when user is not authenticated', async () => {
    const getSettingsSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        UserSettingsStore,
        {
          provide: UserSettingsApi,
          useValue: { getSettings$: getSettingsSpy, cache: mockCache },
        },
        {
          provide: AuthStateService,
          useValue: { isAuthenticated: signal(false) },
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

    const store = TestBed.inject(UserSettingsStore);
    await new Promise((r) => setTimeout(r, 50));

    expect(store.settings()).toBeUndefined();
    expect(getSettingsSpy).not.toHaveBeenCalled();
  });

  it('should not load when client key is missing and not in demo mode', async () => {
    const getSettingsSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        UserSettingsStore,
        {
          provide: UserSettingsApi,
          useValue: { getSettings$: getSettingsSpy, cache: mockCache },
        },
        {
          provide: AuthStateService,
          useValue: { isAuthenticated: signal(true) },
        },
        {
          provide: ClientKeyService,
          useValue: { hasClientKey: signal(false) },
        },
        {
          provide: DemoModeService,
          useValue: { isDemoMode: signal(false) },
        },
      ],
    });

    const store = TestBed.inject(UserSettingsStore);
    await new Promise((r) => setTimeout(r, 50));

    expect(store.settings()).toBeUndefined();
    expect(getSettingsSpy).not.toHaveBeenCalled();
  });

  it('should load in demo mode even without client key', async () => {
    const demoSettings: UserSettings = { payDayOfMonth: 25 };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        UserSettingsStore,
        {
          provide: UserSettingsApi,
          useValue: {
            getSettings$: vi
              .fn()
              .mockReturnValue(of({ data: demoSettings, success: true })),
            cache: mockCache,
          },
        },
        {
          provide: AuthStateService,
          useValue: { isAuthenticated: signal(true) },
        },
        {
          provide: ClientKeyService,
          useValue: { hasClientKey: signal(false) },
        },
        {
          provide: DemoModeService,
          useValue: { isDemoMode: signal(true) },
        },
      ],
    });

    const store = TestBed.inject(UserSettingsStore);

    await vi.waitFor(() => {
      expect(store.settings()).toEqual(demoSettings);
    });
  });
});
