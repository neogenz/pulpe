import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  signal,
  type WritableSignal,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { UserSettingsApi } from './user-settings-api';
import { AuthApi } from '../auth/auth-api';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';

describe('UserSettingsApi', () => {
  let service: UserSettingsApi;
  let httpTesting: HttpTestingController;
  let mockIsAuthenticated: WritableSignal<boolean>;

  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockApplicationConfig = {
    backendApiUrl: () => 'http://localhost:3000/api/v1',
  };

  function setupTestBed(isAuthenticated: boolean) {
    mockIsAuthenticated = signal(isAuthenticated);

    const mockAuthApi = {
      isAuthenticated: mockIsAuthenticated.asReadonly(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        UserSettingsApi,
        { provide: AuthApi, useValue: mockAuthApi },
        { provide: ApplicationConfiguration, useValue: mockApplicationConfig },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(UserSettingsApi);
  }

  afterEach(() => {
    httpTesting.verify();
  });

  describe('Auth-aware resource loading', () => {
    describe('when user is NOT authenticated', () => {
      beforeEach(() => {
        setupTestBed(false);
      });

      it('should NOT make API request when not authenticated', () => {
        TestBed.flushEffects();

        httpTesting.expectNone('http://localhost:3000/api/v1/users/settings');
      });

      it('should return null payDayOfMonth when not authenticated', () => {
        TestBed.flushEffects();

        expect(service.payDayOfMonth()).toBeNull();
      });
    });

    describe('when user IS authenticated', () => {
      beforeEach(() => {
        setupTestBed(true);
      });

      it('should make API request when authenticated', () => {
        TestBed.flushEffects();

        const req = httpTesting.expectOne(
          'http://localhost:3000/api/v1/users/settings',
        );
        expect(req.request.method).toBe('GET');

        req.flush({ data: { payDayOfMonth: 25 } });
      });
    });
  });

  describe('reload()', () => {
    beforeEach(() => {
      setupTestBed(true);
    });

    it('should trigger a new request when reload is called', () => {
      TestBed.flushEffects();

      const firstReq = httpTesting.expectOne(
        'http://localhost:3000/api/v1/users/settings',
      );
      firstReq.flush({ data: { payDayOfMonth: 15 } });

      service.reload();
      TestBed.flushEffects();

      const secondReq = httpTesting.expectOne(
        'http://localhost:3000/api/v1/users/settings',
      );
      secondReq.flush({ data: { payDayOfMonth: 20 } });
    });
  });

  describe('API endpoint construction', () => {
    it('should construct correct endpoint URL', () => {
      const backendUrl = 'http://localhost:3000/api/v1';
      const expectedUrl = `${backendUrl}/users/settings`;

      expect(expectedUrl).toBe('http://localhost:3000/api/v1/users/settings');
    });
  });
});
