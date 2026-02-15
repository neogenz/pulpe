import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MaintenanceApi } from './maintenance-api';
import { ApplicationConfiguration } from '../config/application-configuration';
import { NGROK_SKIP_HEADER } from '../config/ngrok.constants';

describe('MaintenanceApi', () => {
  let service: MaintenanceApi;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockConfig = {
    backendApiUrl: () => 'http://localhost:3000/api/v1',
  };

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [
        MaintenanceApi,
        { provide: ApplicationConfiguration, useValue: mockConfig },
      ],
    });

    service = TestBed.inject(MaintenanceApi);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('checkStatus', () => {
    it('should return MaintenanceStatus when response is ok', async () => {
      const mockStatus = { maintenanceMode: false };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const result = await service.checkStatus();

      expect(result).toEqual(mockStatus);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/maintenance/status',
        {},
      );
    });

    it('should include ngrok header only when URL contains ngrok', async () => {
      const ngrokConfig = {
        backendApiUrl: () => 'https://abc123.ngrok-free.app/api/v1',
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          MaintenanceApi,
          { provide: ApplicationConfiguration, useValue: ngrokConfig },
        ],
      });
      const ngrokService = TestBed.inject(MaintenanceApi);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ maintenanceMode: false }),
      });

      await ngrokService.checkStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://abc123.ngrok-free.app/api/v1/maintenance/status',
        { headers: NGROK_SKIP_HEADER },
      );
    });

    it('should return maintenanceMode true when server indicates maintenance', async () => {
      const mockStatus = { maintenanceMode: true };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const result = await service.checkStatus();

      expect(result).toEqual({ maintenanceMode: true });
    });

    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(service.checkStatus()).rejects.toThrow(
        'Maintenance check failed: 500',
      );
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(service.checkStatus()).rejects.toThrow('Network error');
    });

    it('should return cached result within TTL without fetching again', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ maintenanceMode: false }),
      });

      await service.checkStatus();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const result = await service.checkStatus();
      expect(result).toEqual({ maintenanceMode: false });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fetch again after TTL expires', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ maintenanceMode: false }),
      });

      await service.checkStatus();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(10_001);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ maintenanceMode: true }),
      });

      const result = await service.checkStatus();
      expect(result).toEqual({ maintenanceMode: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate concurrent calls', async () => {
      let resolvePromise: (value: unknown) => void;
      mockFetch.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const promise1 = service.checkStatus();
      const promise2 = service.checkStatus();
      const promise3 = service.checkStatus();

      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ maintenanceMode: false }),
      });

      const [result1, result2, result3] = await Promise.all([
        promise1,
        promise2,
        promise3,
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ maintenanceMode: false });
      expect(result2).toEqual({ maintenanceMode: false });
      expect(result3).toEqual({ maintenanceMode: false });
    });
  });
});
