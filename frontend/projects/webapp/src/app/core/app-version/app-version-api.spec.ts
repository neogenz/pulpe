import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { REQUEST_ID_HEADER } from 'pulpe-shared';

import { ApplicationConfiguration } from '../config/application-configuration';
import { AppVersionApi } from './app-version-api';

const VALID_PAYLOAD = {
  success: true,
  data: {
    ios: { minVersion: '1.0.0', latestVersion: '1.0.2' },
    web: { minVersion: '0.0.1', latestVersion: '0.35.0' },
  },
};

describe('AppVersionApi', () => {
  let service: AppVersionApi;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockConfig = {
    backendApiUrl: () => 'http://localhost:3000/api/v1',
  };
  const FIXED_REQUEST_ID = '00000000-0000-0000-0000-000000000000';

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_REQUEST_ID);

    TestBed.configureTestingModule({
      providers: [
        AppVersionApi,
        { provide: ApplicationConfiguration, useValue: mockConfig },
      ],
    });

    service = TestBed.inject(AppVersionApi);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('fetchVersion', () => {
    it('should fetch and parse the version payload', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(VALID_PAYLOAD),
      });

      const result = await service.fetchVersion();

      expect(result).toEqual(VALID_PAYLOAD);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/app/version',
        { headers: { [REQUEST_ID_HEADER]: FIXED_REQUEST_ID } },
      );
    });

    it('should throw when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(service.fetchVersion()).rejects.toThrow(
        'App version check failed: 500',
      );
    });

    it('should throw when the payload does not match the schema', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      await expect(service.fetchVersion()).rejects.toThrow();
    });

    it('should deduplicate concurrent calls', async () => {
      let resolvePromise: (value: unknown) => void;
      mockFetch.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const promise1 = service.fetchVersion();
      const promise2 = service.fetchVersion();

      resolvePromise!({
        ok: true,
        json: () => Promise.resolve(VALID_PAYLOAD),
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(result1).toEqual(VALID_PAYLOAD);
      expect(result2).toEqual(VALID_PAYLOAD);
    });
  });
});
