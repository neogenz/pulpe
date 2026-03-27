import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import {
  userSettingsResponseSchema,
  deleteAccountResponseSchema,
} from 'pulpe-shared';
import { UserSettingsApi } from './user-settings-api';
import { ApiClient } from '@core/api/api-client';

describe('UserSettingsApi', () => {
  let service: UserSettingsApi;

  const mockApi = {
    get$: vi.fn(),
    put$: vi.fn(),
    delete$: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        UserSettingsApi,
        { provide: ApiClient, useValue: mockApi },
      ],
    });

    service = TestBed.inject(UserSettingsApi);
  });

  describe('getSettings$()', () => {
    it('should call api.get$ with correct path and schema', () => {
      mockApi.get$.mockReturnValue(of({ data: { payDayOfMonth: 15 } }));

      service.getSettings$().subscribe();

      expect(mockApi.get$).toHaveBeenCalledWith(
        '/users/settings',
        userSettingsResponseSchema,
      );
    });
  });

  describe('updateSettings$()', () => {
    it('should call api.put$ with correct path, body and schema', () => {
      mockApi.put$.mockReturnValue(of({ data: { payDayOfMonth: 25 } }));

      service.updateSettings$({ payDayOfMonth: 25 }).subscribe();

      expect(mockApi.put$).toHaveBeenCalledWith(
        '/users/settings',
        { payDayOfMonth: 25 },
        userSettingsResponseSchema,
      );
    });
  });

  describe('deleteAccount()', () => {
    const deleteResponse = {
      message: 'Account scheduled for deletion',
      scheduledDeletionDate: '2025-01-15',
    };

    it('should call api.delete$ with correct path and schema', async () => {
      mockApi.delete$.mockReturnValue(of(deleteResponse));

      await service.deleteAccount();

      expect(mockApi.delete$).toHaveBeenCalledWith(
        '/users/account',
        deleteAccountResponseSchema,
      );
    });

    it('should return the delete response', async () => {
      mockApi.delete$.mockReturnValue(of(deleteResponse));

      const result = await service.deleteAccount();

      expect(result).toEqual(deleteResponse);
    });
  });
});
