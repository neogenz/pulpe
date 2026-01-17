import { TestBed } from '@angular/core/testing';
import type {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { maintenanceGuard } from './maintenance.guard';
import { MaintenanceApi } from './maintenance-api';
import { Logger } from '../logging/logger';
import { ROUTES } from '../routing/routes-constants';

describe('maintenanceGuard', () => {
  let mockMaintenanceApi: { checkStatus: ReturnType<typeof vi.fn> };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let originalLocation: Location;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  beforeEach(() => {
    mockMaintenanceApi = {
      checkStatus: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    // Save and mock window.location
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/some-path',
        href: '',
      },
      writable: true,
      configurable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: MaintenanceApi, useValue: mockMaintenanceApi },
        { provide: Logger, useValue: mockLogger },
      ],
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('should skip check and return true when already on maintenance page', async () => {
    // Arrange
    window.location.pathname = '/' + ROUTES.MAINTENANCE;

    // Act
    const result = await TestBed.runInInjectionContext(() =>
      maintenanceGuard(mockRoute, mockState),
    );

    // Assert
    expect(result).toBe(true);
    expect(mockMaintenanceApi.checkStatus).not.toHaveBeenCalled();
  });

  it('should return true when maintenance mode is off', async () => {
    // Arrange
    mockMaintenanceApi.checkStatus.mockResolvedValue({
      maintenanceMode: false,
    });

    // Act
    const result = await TestBed.runInInjectionContext(() =>
      maintenanceGuard(mockRoute, mockState),
    );

    // Assert
    expect(result).toBe(true);
    expect(window.location.href).toBe('');
  });

  it('should redirect to maintenance page when maintenance mode is on', async () => {
    // Arrange
    mockMaintenanceApi.checkStatus.mockResolvedValue({ maintenanceMode: true });

    // Act
    const result = await TestBed.runInInjectionContext(() =>
      maintenanceGuard(mockRoute, mockState),
    );

    // Assert
    expect(result).toBe(false);
    expect(window.location.href).toBe('/' + ROUTES.MAINTENANCE);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Maintenance mode active, redirecting...',
    );
  });

  it('should redirect to maintenance page on network error (fail-closed)', async () => {
    // Arrange
    mockMaintenanceApi.checkStatus.mockRejectedValue(
      new Error('Network error'),
    );

    // Act
    const result = await TestBed.runInInjectionContext(() =>
      maintenanceGuard(mockRoute, mockState),
    );

    // Assert
    expect(result).toBe(false);
    expect(window.location.href).toBe('/' + ROUTES.MAINTENANCE);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Maintenance status check failed, redirecting to maintenance',
      { error: expect.any(Error) },
    );
  });

  it('should redirect to maintenance page on fetch failure (fail-closed)', async () => {
    // Arrange
    mockMaintenanceApi.checkStatus.mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    // Act
    const result = await TestBed.runInInjectionContext(() =>
      maintenanceGuard(mockRoute, mockState),
    );

    // Assert
    expect(result).toBe(false);
    expect(window.location.href).toBe('/' + ROUTES.MAINTENANCE);
  });
});
