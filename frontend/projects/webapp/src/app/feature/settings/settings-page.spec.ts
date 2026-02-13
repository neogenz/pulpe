import { provideZonelessChangeDetection, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type Observable, of } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { Logger } from '@core/logging/logger';
import { UserSettingsApi } from '@core/user-settings';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { EncryptionApi } from '@core/encryption';
import { DemoModeService } from '@core/demo/demo-mode.service';

import SettingsPage from './settings-page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let mockUserSettingsApi: {
    payDayOfMonth: ReturnType<typeof signal<number | null>>;
    deleteAccount: ReturnType<typeof vi.fn>;
    updateSettings: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockAuthSession: { signOut: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockDialogRef: { afterClosed: () => Observable<boolean> };

  beforeEach(async () => {
    mockDialogRef = {
      afterClosed: () => of(true),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue(mockDialogRef),
    };

    mockUserSettingsApi = {
      payDayOfMonth: signal<number | null>(null),
      deleteAccount: vi.fn().mockResolvedValue({}),
      updateSettings: vi.fn().mockResolvedValue({}),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
    };

    mockAuthSession = {
      signOut: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: UserSettingsApi, useValue: mockUserSettingsApi },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: Logger, useValue: mockLogger },
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true) },
        },
        { provide: AuthSessionService, useValue: mockAuthSession },
        { provide: EncryptionApi, useValue: { setupRecoveryKey$: vi.fn() } },
        { provide: DemoModeService, useValue: { isDemoMode: signal(false) } },
      ],
    })
      .overrideComponent(SettingsPage, {
        set: {
          providers: [
            { provide: MatDialog, useValue: mockDialog },
            { provide: MatSnackBar, useValue: mockSnackBar },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
  });

  async function clickDeleteAccount(): Promise<void> {
    const btn = fixture.nativeElement.querySelector(
      '[data-testid="delete-account-button"]',
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  describe('onDeleteAccount - ApiError handling', () => {
    it('should show network error message when ApiError has status 0', async () => {
      mockUserSettingsApi.deleteAccount.mockRejectedValue(
        new ApiError('Network error', undefined, 0, null),
      );
      await clickDeleteAccount();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Erreur réseau — vérifie ta connexion',
        'OK',
        expect.any(Object),
      );
    });

    it('should show blocked message when ApiError has ERR_USER_ACCOUNT_BLOCKED code', async () => {
      mockUserSettingsApi.deleteAccount.mockRejectedValue(
        new ApiError('Blocked', 'ERR_USER_ACCOUNT_BLOCKED', 403, null),
      );
      await clickDeleteAccount();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Ton compte est déjà programmé pour suppression',
        'OK',
        expect.any(Object),
      );
    });

    it('should show generic error message for other ApiError instances', async () => {
      mockUserSettingsApi.deleteAccount.mockRejectedValue(
        new ApiError('Server error', undefined, 500, null),
      );
      await clickDeleteAccount();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'La suppression a échoué — réessaie plus tard',
        'OK',
        expect.any(Object),
      );
    });
  });

  describe('onDeleteAccount - HttpErrorResponse handling', () => {
    it('should show network error message when HttpErrorResponse has status 0', async () => {
      mockUserSettingsApi.deleteAccount.mockRejectedValue(
        new HttpErrorResponse({ status: 0 }),
      );
      await clickDeleteAccount();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Erreur réseau — vérifie ta connexion',
        'OK',
        expect.any(Object),
      );
    });

    it('should show blocked message when HttpErrorResponse contains ERR_USER_ACCOUNT_BLOCKED', async () => {
      mockUserSettingsApi.deleteAccount.mockRejectedValue(
        new HttpErrorResponse({
          status: 403,
          error: { code: 'ERR_USER_ACCOUNT_BLOCKED' },
        }),
      );
      await clickDeleteAccount();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Ton compte est déjà programmé pour suppression',
        'OK',
        expect.any(Object),
      );
    });

    it('should show generic error message for other HttpErrorResponse', async () => {
      mockUserSettingsApi.deleteAccount.mockRejectedValue(
        new HttpErrorResponse({ status: 500 }),
      );
      await clickDeleteAccount();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'La suppression a échoué — réessaie plus tard',
        'OK',
        expect.any(Object),
      );
    });
  });
});
