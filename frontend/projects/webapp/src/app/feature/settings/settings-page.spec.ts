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
import { UserSettingsStore } from '@core/user-settings';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AuthStore } from '@core/auth';
import { ClientKeyService, EncryptionApi } from '@core/encryption';
import { DemoModeService } from '@core/demo/demo-mode.service';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { CurrencyConverterService } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { AnalyticsService } from '@core/analytics';

import SettingsPage from './settings-page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let mockUserSettingsStore: {
    payDayOfMonth: ReturnType<typeof signal<number | null>>;
    currency: ReturnType<typeof signal<string>>;
    showCurrencySelector: ReturnType<typeof signal<boolean>>;
    updateSettings: ReturnType<typeof vi.fn>;
    deleteAccount: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockAuthSession: { signOut: ReturnType<typeof vi.fn> };
  let mockAuthStore: { isOAuthOnly: ReturnType<typeof signal<boolean>> };
  let mockFeatureFlags: {
    isMultiCurrencyEnabled: ReturnType<typeof signal<boolean>>;
  };
  let mockAnalytics: {
    captureEvent: ReturnType<typeof vi.fn>;
    setPersonProperties: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockDialogRef: { afterClosed: () => Observable<boolean> };

  beforeEach(async () => {
    mockDialogRef = {
      afterClosed: () => of(true),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue(mockDialogRef),
    };

    mockUserSettingsStore = {
      payDayOfMonth: signal<number | null>(null),
      currency: signal('CHF'),
      showCurrencySelector: signal(false),
      updateSettings: vi.fn().mockResolvedValue({}),
      deleteAccount: vi.fn().mockResolvedValue(undefined),
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

    mockAuthStore = {
      isOAuthOnly: signal(false),
    };

    mockFeatureFlags = {
      isMultiCurrencyEnabled: signal(true),
    };

    mockAnalytics = {
      captureEvent: vi.fn(),
      setPersonProperties: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        ...provideTranslocoForTest(),
        { provide: UserSettingsStore, useValue: mockUserSettingsStore },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: Logger, useValue: mockLogger },
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true) },
        },
        { provide: AuthSessionService, useValue: mockAuthSession },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: FeatureFlagsService, useValue: mockFeatureFlags },
        { provide: AnalyticsService, useValue: mockAnalytics },
        {
          provide: EncryptionApi,
          useValue: {
            regenerateRecoveryKey$: vi.fn(),
            verifyRecoveryKey$: vi.fn().mockReturnValue(of(undefined)),
          },
        },
        { provide: DemoModeService, useValue: { isDemoMode: signal(false) } },
        { provide: ClientKeyService, useValue: { clear: vi.fn() } },
        {
          provide: CurrencyConverterService,
          useValue: { fetchRate: vi.fn(), convert: vi.fn() },
        },
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
      mockUserSettingsStore.deleteAccount.mockRejectedValue(
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
      mockUserSettingsStore.deleteAccount.mockRejectedValue(
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
      mockUserSettingsStore.deleteAccount.mockRejectedValue(
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

  describe('change-password-button visibility', () => {
    it('should hide change-password-button when user is OAuth', async () => {
      mockAuthStore.isOAuthOnly.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const btn = fixture.nativeElement.querySelector(
        '[data-testid="change-password-button"]',
      );
      expect(btn).toBeNull();
    });

    it('should show change-password-button when user is not OAuth', async () => {
      mockAuthStore.isOAuthOnly.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      const btn = fixture.nativeElement.querySelector(
        '[data-testid="change-password-button"]',
      );
      expect(btn).not.toBeNull();
    });
  });

  describe('currency section visibility', () => {
    it('should hide currency-toggle when isMultiCurrencyEnabled is false', async () => {
      mockFeatureFlags.isMultiCurrencyEnabled.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      const toggle = fixture.nativeElement.querySelector(
        '[data-testid="currency-toggle"]',
      );

      expect(toggle).toBeNull();
    });

    it('should show currency-toggle when isMultiCurrencyEnabled is true', async () => {
      mockFeatureFlags.isMultiCurrencyEnabled.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const toggle = fixture.nativeElement.querySelector(
        '[data-testid="currency-toggle"]',
      );

      expect(toggle).not.toBeNull();
    });
  });

  describe('onDeleteAccount - HttpErrorResponse handling', () => {
    it('should show network error message when HttpErrorResponse has status 0', async () => {
      mockUserSettingsStore.deleteAccount.mockRejectedValue(
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
      mockUserSettingsStore.deleteAccount.mockRejectedValue(
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
      mockUserSettingsStore.deleteAccount.mockRejectedValue(
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

  describe('saveSettings currency analytics', () => {
    async function saveSettings(): Promise<void> {
      await fixture.componentInstance.saveSettings();
      await fixture.whenStable();
    }

    it('should not capture any event when neither currency nor selector change', async () => {
      await saveSettings();

      expect(mockAnalytics.captureEvent).not.toHaveBeenCalled();
    });

    it('should not refresh person properties when nothing currency-related changed', async () => {
      await saveSettings();

      expect(mockAnalytics.setPersonProperties).not.toHaveBeenCalled();
    });

    it('should capture currency_changed when currency changes', async () => {
      fixture.componentInstance.onCurrencyChange('EUR');

      await saveSettings();

      expect(mockAnalytics.captureEvent).toHaveBeenCalledWith(
        'currency_changed',
        { from: 'CHF', to: 'EUR' },
      );
      expect(mockAnalytics.setPersonProperties).toHaveBeenCalledWith({
        currency: 'EUR',
        show_currency_selector: false,
      });
    });

    it('should capture currency_selector_toggled when toggle changes', async () => {
      fixture.componentInstance.onShowCurrencySelectorChange(true);

      await saveSettings();

      expect(mockAnalytics.captureEvent).toHaveBeenCalledWith(
        'currency_selector_toggled',
        { enabled: true },
      );
      expect(mockAnalytics.setPersonProperties).toHaveBeenCalledWith({
        currency: 'CHF',
        show_currency_selector: true,
      });
    });

    it('should capture both events when both currency and selector change', async () => {
      fixture.componentInstance.onCurrencyChange('EUR');
      fixture.componentInstance.onShowCurrencySelectorChange(true);

      await saveSettings();

      expect(mockAnalytics.captureEvent).toHaveBeenCalledWith(
        'currency_changed',
        { from: 'CHF', to: 'EUR' },
      );
      expect(mockAnalytics.captureEvent).toHaveBeenCalledWith(
        'currency_selector_toggled',
        { enabled: true },
      );
      expect(mockAnalytics.captureEvent).toHaveBeenCalledTimes(2);
    });

    it('should not capture analytics when updateSettings rejects', async () => {
      mockUserSettingsStore.updateSettings.mockRejectedValueOnce(
        new Error('boom'),
      );
      fixture.componentInstance.onCurrencyChange('EUR');

      await saveSettings();

      expect(mockAnalytics.captureEvent).not.toHaveBeenCalled();
      expect(mockAnalytics.setPersonProperties).not.toHaveBeenCalled();
    });
  });
});
