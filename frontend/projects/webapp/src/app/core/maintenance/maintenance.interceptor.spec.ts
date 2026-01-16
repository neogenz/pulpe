import { TestBed } from '@angular/core/testing';
import {
  HttpErrorResponse,
  HttpRequest,
  HttpResponse,
  type HttpHandlerFn,
} from '@angular/common/http';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of, throwError, firstValueFrom } from 'rxjs';
import { maintenanceInterceptor } from './maintenance.interceptor';
import { Logger } from '../logging/logger';
import { ROUTES } from '../routing/routes-constants';

describe('maintenanceInterceptor', () => {
  let mockLogger: { info: ReturnType<typeof vi.fn> };
  let originalLocation: Location;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
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
      providers: [{ provide: Logger, useValue: mockLogger }],
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  const createMockRequest = (): HttpRequest<unknown> =>
    new HttpRequest('GET', '/api/test');

  it('should pass through successful responses', async () => {
    // Arrange
    const mockResponse = new HttpResponse({
      status: 200,
      body: { data: 'test' },
    });
    const mockNext: HttpHandlerFn = () => of(mockResponse);
    const request = createMockRequest();

    // Act
    const result = await TestBed.runInInjectionContext(async () => {
      const observable = maintenanceInterceptor(request, mockNext);
      return firstValueFrom(observable);
    });

    // Assert
    expect(result).toBe(mockResponse);
  });

  it('should pass through non-503 errors', async () => {
    // Arrange
    const error = new HttpErrorResponse({
      status: 404,
      statusText: 'Not Found',
    });
    const mockNext: HttpHandlerFn = () => throwError(() => error);
    const request = createMockRequest();

    // Act & Assert
    await TestBed.runInInjectionContext(async () => {
      const observable = maintenanceInterceptor(request, mockNext);
      await expect(firstValueFrom(observable)).rejects.toThrow();
    });
    expect(window.location.href).toBe('');
  });

  it('should pass through 503 errors without MAINTENANCE code', async () => {
    // Arrange
    const error = new HttpErrorResponse({
      status: 503,
      statusText: 'Service Unavailable',
      error: { code: 'OTHER_ERROR' },
    });
    const mockNext: HttpHandlerFn = () => throwError(() => error);
    const request = createMockRequest();

    // Act & Assert
    await TestBed.runInInjectionContext(async () => {
      const observable = maintenanceInterceptor(request, mockNext);
      await expect(firstValueFrom(observable)).rejects.toThrow();
    });
    expect(window.location.href).toBe('');
  });

  it('should redirect to maintenance page on 503 with MAINTENANCE code', async () => {
    // Arrange
    const error = new HttpErrorResponse({
      status: 503,
      statusText: 'Service Unavailable',
      error: { code: 'MAINTENANCE' },
    });
    const mockNext: HttpHandlerFn = () => throwError(() => error);
    const request = createMockRequest();

    // Act
    await TestBed.runInInjectionContext(async () => {
      const observable = maintenanceInterceptor(request, mockNext);
      // EMPTY completes without emitting, so we catch the empty error
      try {
        await firstValueFrom(observable);
      } catch {
        // Expected - EMPTY throws EmptyError when using firstValueFrom
      }
    });

    // Assert
    expect(window.location.href).toBe('/' + ROUTES.MAINTENANCE);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Maintenance mode detected, redirecting...',
    );
  });

  it('should return EMPTY without redirect when already on maintenance page', async () => {
    // Arrange
    window.location.pathname = '/' + ROUTES.MAINTENANCE;
    const error = new HttpErrorResponse({
      status: 503,
      statusText: 'Service Unavailable',
      error: { code: 'MAINTENANCE' },
    });
    const mockNext: HttpHandlerFn = () => throwError(() => error);
    const request = createMockRequest();

    // Act
    await TestBed.runInInjectionContext(async () => {
      const observable = maintenanceInterceptor(request, mockNext);
      try {
        await firstValueFrom(observable);
      } catch {
        // Expected - EMPTY throws EmptyError
      }
    });

    // Assert
    expect(window.location.href).toBe('');
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});
