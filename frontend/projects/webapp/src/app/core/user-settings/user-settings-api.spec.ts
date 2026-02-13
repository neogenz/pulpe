import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  signal,
  type WritableSignal,
} from '@angular/core';
import { of, throwError } from 'rxjs';
import {
  userSettingsResponseSchema,
  deleteAccountResponseSchema,
} from 'pulpe-shared';
import { UserSettingsApi } from './user-settings-api';
import { ApiClient } from '@core/api/api-client';
import { AuthStateService } from '../auth/auth-state.service';
import { Logger } from '../logging/logger';

describe('UserSettingsApi', () => {
  let service: UserSettingsApi;
  let mockIsAuthenticated: WritableSignal<boolean>;

  const mockApi = {
    get$: vi.fn(),
    put$: vi.fn(),
    delete$: vi.fn(),
  };

  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  function setupTestBed(isAuthenticated: boolean) {
    mockIsAuthenticated = signal(isAuthenticated);

    const mockAuthStateService = {
      isAuthenticated: mockIsAuthenticated.asReadonly(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        UserSettingsApi,
        { provide: ApiClient, useValue: mockApi },
        { provide: AuthStateService, useValue: mockAuthStateService },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(UserSettingsApi);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth-aware resource loading', () => {
    describe('when user is NOT authenticated', () => {
      beforeEach(() => {
        setupTestBed(false);
      });

      it('should NOT call api.get$ when not authenticated', () => {
        TestBed.flushEffects();

        expect(mockApi.get$).not.toHaveBeenCalled();
      });

      it('should return null payDayOfMonth when not authenticated', () => {
        TestBed.flushEffects();

        expect(service.payDayOfMonth()).toBeNull();
      });
    });

    describe('when user IS authenticated', () => {
      beforeEach(() => {
        mockApi.get$.mockReturnValue(of({ data: { payDayOfMonth: 25 } }));
        setupTestBed(true);
      });

      it('should call api.get$ with correct path and schema', () => {
        TestBed.flushEffects();

        expect(mockApi.get$).toHaveBeenCalledWith(
          '/users/settings',
          userSettingsResponseSchema,
        );
      });
    });

    describe('when loading fails', () => {
      beforeEach(() => {
        mockApi.get$.mockReturnValue(
          throwError(() => new Error('Network error')),
        );
        setupTestBed(true);
      });

      it('should return default settings on error', async () => {
        TestBed.flushEffects();
        await vi.waitFor(() => {
          expect(service.settings()).toEqual({ payDayOfMonth: null });
        });
      });

      it('should log the error', async () => {
        TestBed.flushEffects();
        await vi.waitFor(() => {
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to load user settings',
            expect.objectContaining({ error: expect.anything() }),
          );
        });
      });
    });
  });

  describe('updateSettings()', () => {
    beforeEach(() => {
      mockApi.get$.mockReturnValue(of({ data: { payDayOfMonth: 15 } }));
      mockApi.put$.mockReturnValue(of({ data: { payDayOfMonth: 25 } }));
      setupTestBed(true);
    });

    it('should call api.put$ with correct path, body and schema', async () => {
      await service.updateSettings({ payDayOfMonth: 25 });

      expect(mockApi.put$).toHaveBeenCalledWith(
        '/users/settings',
        { payDayOfMonth: 25 },
        userSettingsResponseSchema,
      );
    });

    it('should return updated settings data', async () => {
      const result = await service.updateSettings({ payDayOfMonth: 25 });

      expect(result).toEqual({ payDayOfMonth: 25 });
    });
  });

  describe('deleteAccount()', () => {
    const deleteResponse = {
      message: 'Account scheduled for deletion',
      scheduledDeletionDate: '2025-01-15',
    };

    beforeEach(() => {
      mockApi.get$.mockReturnValue(of({ data: { payDayOfMonth: 15 } }));
      mockApi.delete$.mockReturnValue(of(deleteResponse));
      setupTestBed(true);
    });

    it('should call api.delete$ with correct path and schema', async () => {
      await service.deleteAccount();

      expect(mockApi.delete$).toHaveBeenCalledWith(
        '/users/account',
        deleteAccountResponseSchema,
      );
    });

    it('should return the delete response', async () => {
      const result = await service.deleteAccount();

      expect(result).toEqual(deleteResponse);
    });
  });

  describe('reload()', () => {
    beforeEach(() => {
      mockApi.get$.mockReturnValue(of({ data: { payDayOfMonth: 15 } }));
      setupTestBed(true);
    });

    it('should trigger a new api.get$ call when reload is called', () => {
      TestBed.flushEffects();
      mockApi.get$.mockClear();

      mockApi.get$.mockReturnValue(of({ data: { payDayOfMonth: 20 } }));
      service.reload();
      TestBed.flushEffects();

      expect(mockApi.get$).toHaveBeenCalledWith(
        '/users/settings',
        userSettingsResponseSchema,
      );
    });
  });
});
