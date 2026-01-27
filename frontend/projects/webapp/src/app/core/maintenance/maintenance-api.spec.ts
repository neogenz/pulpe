import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MaintenanceApi } from './maintenance-api';
import { ApplicationConfiguration } from '../config/application-configuration';

describe('MaintenanceApi', () => {
  let service: MaintenanceApi;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockConfig = {
    backendApiUrl: () => 'http://localhost:3000/api/v1',
  };

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

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
  });

  describe('checkStatus', () => {
    it('should return MaintenanceStatus when response is ok', async () => {
      // Arrange
      const mockStatus = { maintenanceMode: false };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      // Act
      const result = await service.checkStatus();

      // Assert
      expect(result).toEqual(mockStatus);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/maintenance/status',
        { headers: { 'ngrok-skip-browser-warning': 'true' } },
      );
    });

    it('should return maintenanceMode true when server indicates maintenance', async () => {
      // Arrange
      const mockStatus = { maintenanceMode: true };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      // Act
      const result = await service.checkStatus();

      // Assert
      expect(result).toEqual({ maintenanceMode: true });
    });

    it('should throw error when response is not ok', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      // Act & Assert
      await expect(service.checkStatus()).rejects.toThrow(
        'Maintenance check failed: 500',
      );
    });

    it('should throw error when fetch fails', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(service.checkStatus()).rejects.toThrow('Network error');
    });
  });
});
