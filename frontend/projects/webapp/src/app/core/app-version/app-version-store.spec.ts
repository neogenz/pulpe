import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AppVersionResponse } from 'pulpe-shared';

import { Logger } from '@core/logging/logger';

import { AppVersionApi } from './app-version-api';
import { AppVersionStore } from './app-version-store';
import { CURRENT_APP_VERSION } from './current-app-version';

const createVersionResponse = (minVersion: string): AppVersionResponse => ({
  success: true,
  data: {
    ios: { minVersion: '1.0.0', latestVersion: '1.0.0' },
    web: { minVersion, latestVersion: '9.9.9' },
  },
});

describe('AppVersionStore', () => {
  let store: AppVersionStore;
  let mockFetchVersion: ReturnType<typeof vi.fn>;

  const mockLogger = {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    mockFetchVersion = vi.fn();
    mockLogger.warn.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: AppVersionApi,
          useValue: { fetchVersion: mockFetchVersion },
        },
        { provide: CURRENT_APP_VERSION, useValue: '1.0.0' },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    store = TestBed.inject(AppVersionStore);
  });

  describe('check', () => {
    it('should require update when current version is below web.minVersion', async () => {
      mockFetchVersion.mockResolvedValue(createVersionResponse('2.0.0'));

      await store.check();

      expect(store.isUpdateRequired()).toBe(true);
    });

    it('should not require update when current version meets web.minVersion', async () => {
      mockFetchVersion.mockResolvedValue(createVersionResponse('1.0.0'));

      await store.check();

      expect(store.isUpdateRequired()).toBe(false);
    });

    it('should fail open when the first check errors', async () => {
      mockFetchVersion.mockRejectedValue(new Error('Network error'));

      await store.check();

      expect(store.isUpdateRequired()).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledOnce();
    });

    it('should keep an already-shown gate when a later check errors', async () => {
      mockFetchVersion.mockResolvedValue(createVersionResponse('2.0.0'));
      await store.check();
      expect(store.isUpdateRequired()).toBe(true);

      mockFetchVersion.mockRejectedValue(new Error('Network error'));
      await store.check();

      expect(store.isUpdateRequired()).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should check immediately on initialize', () => {
      mockFetchVersion.mockResolvedValue(createVersionResponse('1.0.0'));

      store.initialize();

      expect(mockFetchVersion).toHaveBeenCalledOnce();
    });

    it('should re-check when the tab becomes visible', () => {
      mockFetchVersion.mockResolvedValue(createVersionResponse('1.0.0'));
      store.initialize();

      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockFetchVersion).toHaveBeenCalledTimes(2);
    });

    it('should re-check on pageshow restored from bfcache', () => {
      mockFetchVersion.mockResolvedValue(createVersionResponse('1.0.0'));
      store.initialize();

      const event = new Event('pageshow');
      Object.defineProperty(event, 'persisted', {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(event);

      expect(mockFetchVersion).toHaveBeenCalledTimes(2);
    });

    it('should only register listeners once across multiple initialize calls', () => {
      mockFetchVersion.mockResolvedValue(createVersionResponse('1.0.0'));

      store.initialize();
      store.initialize();

      expect(mockFetchVersion).toHaveBeenCalledOnce();
    });

    it('should remove event listeners on destroy', () => {
      mockFetchVersion.mockResolvedValue(createVersionResponse('1.0.0'));
      store.initialize();

      TestBed.resetTestingModule();
      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockFetchVersion).toHaveBeenCalledOnce();
    });
  });
});
