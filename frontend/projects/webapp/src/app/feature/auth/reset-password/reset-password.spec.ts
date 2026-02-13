import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import {
  AuthSessionService,
  AuthStateService,
  PASSWORD_MIN_LENGTH,
} from '@core/auth';
import { ClientKeyService, EncryptionApi } from '@core/encryption';
import * as cryptoUtils from '@core/encryption/crypto.utils';
import { ApiError } from '@core/api/api-error';
import { Logger } from '@core/logging/logger';

import ResetPassword from './reset-password';

describe('ResetPassword', () => {
  let fixture: ComponentFixture<ResetPassword>;
  let component: ResetPassword;
  let mockAuthSessionService: { updatePassword: ReturnType<typeof vi.fn> };
  let mockAuthStateService: {
    isLoading: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
    authState: ReturnType<typeof vi.fn>;
  };
  let mockClientKeyService: { setDirectKey: ReturnType<typeof vi.fn> };
  let mockEncryptionApi: {
    getSalt$: ReturnType<typeof vi.fn>;
    recover$: ReturnType<typeof vi.fn>;
    setupRecoveryKey$: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockDialogRef: { afterClosed: ReturnType<typeof vi.fn> };
  let navigateSpy: ReturnType<typeof vi.fn>;
  let deriveClientKeySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    deriveClientKeySpy = vi
      .spyOn(cryptoUtils, 'deriveClientKey')
      .mockResolvedValue('abcd'.repeat(16));
    mockDialogRef = {
      afterClosed: vi.fn().mockReturnValue(of(true)),
    };

    mockAuthSessionService = {
      updatePassword: vi.fn(),
    };

    mockAuthStateService = {
      isLoading: vi.fn().mockReturnValue(false),
      isAuthenticated: vi.fn().mockReturnValue(true),
      authState: vi.fn().mockReturnValue({
        user: { user_metadata: {} },
        session: {},
        isLoading: false,
        isAuthenticated: true,
      }),
    };

    mockClientKeyService = {
      setDirectKey: vi.fn(),
    };

    mockEncryptionApi = {
      getSalt$: vi.fn().mockReturnValue(
        of({
          salt: 'salt-value',
          kdfIterations: 100000,
          hasRecoveryKey: true, // Default: user HAS recovery key configured
        }),
      ),
      recover$: vi.fn().mockReturnValue(of({ success: true })),
      setupRecoveryKey$: vi
        .fn()
        .mockReturnValue(of({ recoveryKey: 'ABCD-EFGH-IJKL-MNOP' })),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue(mockDialogRef),
    };

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: AuthSessionService, useValue: mockAuthSessionService },
        { provide: AuthStateService, useValue: mockAuthStateService },
        { provide: ClientKeyService, useValue: mockClientKeyService },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: MatDialog, useValue: mockDialog },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPassword);
    component = fixture.componentInstance;

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // Wait for session check AND salt fetch to complete
    await vi.waitFor(() => expect(component['isSessionValid']()).toBe(true));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  async function fillFormViaDom(
    recoveryKey: string,
    password: string,
    confirmPassword: string,
  ): Promise<void> {
    const recoveryInput = fixture.nativeElement.querySelector(
      '[data-testid="recovery-key-input"]',
    ) as HTMLInputElement | null;
    if (recoveryInput) {
      recoveryInput.value = recoveryKey;
      recoveryInput.dispatchEvent(new Event('input'));
    }

    const passwordInput = fixture.nativeElement.querySelector(
      '[data-testid="new-password-input"]',
    ) as HTMLInputElement;
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input'));

    const confirmInput = fixture.nativeElement.querySelector(
      '[data-testid="confirm-password-input"]',
    ) as HTMLInputElement;
    confirmInput.value = confirmPassword;
    confirmInput.dispatchEvent(new Event('input'));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function fillValidForm(): Promise<void> {
    await fillFormViaDom(
      'ABCD-EFGH-IJKL-MNOP',
      'newpassword123',
      'newpassword123',
    );
  }

  async function submitFormViaDom(): Promise<void> {
    const formDE = fixture.debugElement.query(
      (el) =>
        el.nativeElement.getAttribute?.('data-testid') ===
        'reset-password-form',
    );
    formDE.triggerEventHandler('ngSubmit');
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function isSubmitDisabled(): boolean {
    return !component['canSubmit']();
  }

  function getErrorAlertText(): string {
    const alert = fixture.nativeElement.querySelector('pulpe-error-alert span');
    return alert?.textContent?.trim() ?? '';
  }

  function getPasswordInputType(): string {
    const input = fixture.nativeElement.querySelector(
      '[data-testid="new-password-input"]',
    ) as HTMLInputElement;
    return input.type;
  }

  function getConfirmPasswordInputType(): string {
    const input = fixture.nativeElement.querySelector(
      '[data-testid="confirm-password-input"]',
    ) as HTMLInputElement;
    return input.type;
  }

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should render the reset password page', () => {
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="reset-password-page"]',
        ),
      ).toBeTruthy();
    });

    it('should render the form with all fields', () => {
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="reset-password-form"]',
        ),
      ).toBeTruthy();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="new-password-input"]',
        ),
      ).toBeTruthy();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="confirm-password-input"]',
        ),
      ).toBeTruthy();
    });

    it('should render the submit button', () => {
      expect(
        fixture.nativeElement.querySelector('pulpe-loading-button'),
      ).toBeTruthy();
    });
  });

  describe('Session Check (effect)', () => {
    it('should show the reset password form when authenticated', () => {
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="reset-password-form"]',
        ),
      ).toBeTruthy();
    });

    it('should set isSessionValid to false when not authenticated', async () => {
      mockAuthStateService.isAuthenticated.mockReturnValue(false);

      const newComponent =
        TestBed.createComponent(ResetPassword).componentInstance;
      // When not authenticated, salt fetch doesn't start, so just wait for auth check
      await vi.waitFor(() =>
        expect(newComponent['isCheckingSession']()).toBe(false),
      );

      expect(newComponent['isSessionValid']()).toBe(false);
    });

    it('should not show spinner after session check completes', () => {
      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeFalsy();
    });
  });

  describe('Default Values', () => {
    it('should have password fields hidden by default', () => {
      expect(getPasswordInputType()).toBe('password');
      expect(getConfirmPasswordInputType()).toBe('password');
    });

    it('should have submit button disabled by default (empty form)', () => {
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should have no error message by default', () => {
      expect(getErrorAlertText()).toBe('');
    });

    it('should not show spinner after init', () => {
      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeFalsy();
    });

    it('should show the reset password form by default (authenticated)', () => {
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="reset-password-form"]',
        ),
      ).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('should show recovery key required error when submitted empty', async () => {
      await fillFormViaDom('', 'newpassword123', 'newpassword123');
      await submitFormViaDom();
      fixture.detectChanges();

      const matErrors = fixture.nativeElement.querySelectorAll('mat-error');
      const texts = Array.from(matErrors as NodeListOf<Element>).map((el) =>
        el.textContent?.trim(),
      );
      expect(texts.some((t) => t?.includes('récupération'))).toBe(true);
    });

    it('should keep submit button disabled when newPassword is empty', async () => {
      await fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '', 'newpassword123');
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should keep submit button disabled when password is too short', async () => {
      await fillFormViaDom('ABCD-EFGH-IJKL-MNOP', 'short', 'short');
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should use PASSWORD_MIN_LENGTH constant for validation', async () => {
      const shortPassword = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
      const validPassword = 'a'.repeat(PASSWORD_MIN_LENGTH);

      await fillFormViaDom('ABCD-EFGH-IJKL-MNOP', shortPassword, shortPassword);
      expect(isSubmitDisabled()).toBe(true);

      await fillFormViaDom('ABCD-EFGH-IJKL-MNOP', validPassword, validPassword);
      expect(isSubmitDisabled()).toBe(false);
    });

    it('should keep submit button disabled when confirmPassword is empty', async () => {
      await fillFormViaDom('ABCD-EFGH-IJKL-MNOP', 'newpassword123', '');
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should enable submit button when form is valid', async () => {
      await fillValidForm();
      expect(isSubmitDisabled()).toBe(false);
    });
  });

  describe('passwordsMatchValidator', () => {
    it('should not disable submit when both fields are empty', async () => {
      await fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '', '');
      // Button disabled because fields are required, not because of mismatch
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should enable submit when passwords match', async () => {
      await fillFormViaDom(
        'ABCD-EFGH-IJKL-MNOP',
        'newpassword123',
        'newpassword123',
      );
      expect(isSubmitDisabled()).toBe(false);
    });

    it('should disable submit when passwords do not match', async () => {
      await fillFormViaDom(
        'ABCD-EFGH-IJKL-MNOP',
        'newpassword123',
        'differentpassword',
      );
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should show mismatch error in DOM after submit attempt', async () => {
      await fillFormViaDom(
        'ABCD-EFGH-IJKL-MNOP',
        'newpassword123',
        'differentpassword',
      );
      await submitFormViaDom();

      const matErrors = fixture.nativeElement.querySelectorAll('mat-error');
      const texts = Array.from(matErrors as NodeListOf<Element>).map((el) =>
        el.textContent?.trim(),
      );
      expect(texts.some((t) => t?.includes('ne correspondent pas'))).toBe(true);
    });
  });

  describe('Submit button state', () => {
    it('should be disabled when form is invalid', () => {
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should be enabled when form is valid', async () => {
      await fillValidForm();
      expect(isSubmitDisabled()).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear error message when typing into password field', () => {
      component['errorMessage'].set('Some error');
      expect(component['errorMessage']()).toBe('Some error');

      const passwordInput = fixture.nativeElement.querySelector(
        '[data-testid="new-password-input"]',
      ) as HTMLInputElement;
      passwordInput.dispatchEvent(new Event('input'));

      expect(component['errorMessage']()).toBe('');
    });
  });

  describe('onSubmit - Invalid Form', () => {
    it('should not submit when form is invalid', async () => {
      mockEncryptionApi.recover$.mockClear();

      await submitFormViaDom();

      expect(mockEncryptionApi.recover$).not.toHaveBeenCalled();
    });

    it('should show validation errors when submitting invalid form', async () => {
      await submitFormViaDom();
      fixture.detectChanges();

      const matErrors = fixture.nativeElement.querySelectorAll('mat-error');
      expect(matErrors.length).toBeGreaterThan(0);
    });
  });

  describe('onSubmit - Valid Form', () => {
    beforeEach(async () => {
      await fillValidForm();
      mockAuthSessionService.updatePassword.mockResolvedValue({
        success: true,
      });
    });

    it('should disable submit while submitting and re-enable after', async () => {
      // Submitting sets isSubmitting to true which makes canSubmit false
      await submitFormViaDom();

      // After submit completes, isSubmitting is reset to false
      await vi.waitFor(() => expect(isSubmitDisabled()).toBe(false));
    });

    it('should clear error message before submitting', async () => {
      component['errorMessage'].set('Previous error');

      await submitFormViaDom();

      expect(component['errorMessage']()).toBe('');
    });

    it('should call getSalt$ to get encryption salt', async () => {
      await submitFormViaDom();

      expect(mockEncryptionApi.getSalt$).toHaveBeenCalled();
    });

    it('should call deriveClientKey with password and salt', async () => {
      await submitFormViaDom();

      expect(deriveClientKeySpy).toHaveBeenCalledWith(
        'newpassword123',
        'salt-value',
        100000,
      );
    });

    it('should call recover$ with recovery key and derived client key', async () => {
      await submitFormViaDom();

      expect(mockEncryptionApi.recover$).toHaveBeenCalledWith(
        'ABCD-EFGH-IJKL-MNOP',
        'abcd'.repeat(16),
      );
    });

    it('should call setDirectKey with derived client key', async () => {
      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
          'abcd'.repeat(16),
        ),
      );
    });

    it('should call updatePassword with new password', async () => {
      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(mockAuthSessionService.updatePassword).toHaveBeenCalledWith(
          'newpassword123',
        ),
      );
    });

    it('should call setupRecoveryKey$ after successful password update', async () => {
      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(mockEncryptionApi.setupRecoveryKey$).toHaveBeenCalled(),
      );
    });

    it('should open recovery dialog after successful password update', async () => {
      await submitFormViaDom();

      await vi.waitFor(() => expect(mockDialog.open).toHaveBeenCalled());
    });

    it('should navigate to dashboard after dialog closes', async () => {
      mockDialogRef.afterClosed.mockReturnValue(of(true));

      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(navigateSpy).toHaveBeenCalledWith(['/', 'dashboard']),
      );
    });

    it('should re-enable submit button after onSubmit completes', async () => {
      await submitFormViaDom();

      await vi.waitFor(() => expect(isSubmitDisabled()).toBe(false));
    });
  });

  describe('onSubmit - recover$ failure', () => {
    beforeEach(async () => {
      await fillValidForm();
      mockAuthSessionService.updatePassword.mockResolvedValue({
        success: true,
      });
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }),
        ),
      );
    });

    it('should show recovery key error message on 400 response', async () => {
      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          'Clé de récupération invalide',
        ),
      );
    });

    it('should not call setDirectKey on recover$ failure', async () => {
      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(mockClientKeyService.setDirectKey).not.toHaveBeenCalled(),
      );
    });

    it('should have called updatePassword before recover$ fails', async () => {
      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(mockAuthSessionService.updatePassword).toHaveBeenCalledWith(
          'newpassword123',
        ),
      );
    });

    it('should re-enable submit button on recover$ failure', async () => {
      await submitFormViaDom();

      await vi.waitFor(() => expect(isSubmitDisabled()).toBe(false));
    });
  });

  describe('onSubmit - recover$ ApiError handling', () => {
    beforeEach(async () => {
      await fillFormViaDom(
        'ABCD-EFGH-IJKL-MNOP',
        'newpassword123',
        'newpassword123',
      );
      mockAuthSessionService.updatePassword.mockResolvedValue({
        success: true,
      });
    });

    it('should show recovery key error message on ApiError with status 400', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(() => new ApiError('Bad request', 'ERR_INVALID', 400, null)),
      );
      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          'Clé de récupération invalide',
        ),
      );
    });

    it('should show generic error when recover$ throws ApiError with status 500', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(() => new ApiError('Server error', undefined, 500, null)),
      );
      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          "Quelque chose n'a pas fonctionné",
        ),
      );
    });
  });

  describe('onSubmit - updatePassword failure', () => {
    beforeEach(async () => {
      await fillValidForm();
      mockAuthSessionService.updatePassword.mockResolvedValue({
        success: false,
        error: 'Password update failed',
      });
    });

    it('should show error message for password update failure', async () => {
      await submitFormViaDom();

      await vi.waitFor(() => expect(component['errorMessage']()).toBeTruthy());
    });

    it('should not call recover$ when password update fails', async () => {
      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(mockEncryptionApi.recover$).not.toHaveBeenCalled(),
      );
    });

    it('should re-enable submit button on password update failure', async () => {
      await submitFormViaDom();

      await vi.waitFor(() => expect(isSubmitDisabled()).toBe(false));
    });

    it('should not navigate on password update failure', async () => {
      await submitFormViaDom();

      await vi.waitFor(() => expect(navigateSpy).not.toHaveBeenCalled());
    });
  });

  describe('onSubmit - Vault-code user (hasVaultCode=true)', () => {
    let vaultFixture: ComponentFixture<ResetPassword>;

    beforeEach(async () => {
      mockAuthStateService.authState.mockReturnValue({
        user: { user_metadata: { vaultCodeConfigured: true } },
        session: {},
        isLoading: false,
        isAuthenticated: true,
      });
      mockEncryptionApi.getSalt$.mockReturnValue(
        of({
          salt: 'salt-value',
          kdfIterations: 100000,
          hasRecoveryKey: true,
        }),
      );

      vaultFixture = TestBed.createComponent(ResetPassword);
      component = vaultFixture.componentInstance;

      await vi.waitFor(() => expect(component['isSessionValid']()).toBe(true));
      vaultFixture.detectChanges();

      mockAuthSessionService.updatePassword.mockResolvedValue({
        success: true,
      });
    });

    it('should hide recovery key field for vault-code users', () => {
      const recoveryInput = vaultFixture.nativeElement.querySelector(
        '[data-testid="recovery-key-input"]',
      );
      expect(recoveryInput).toBeFalsy();
    });

    it('should use simple password reset flow without encryption recovery', async () => {
      // Fill form via DOM on the vault fixture
      const passwordInput = vaultFixture.nativeElement.querySelector(
        '[data-testid="new-password-input"]',
      ) as HTMLInputElement;
      passwordInput.value = 'newpassword123';
      passwordInput.dispatchEvent(new Event('input'));

      const confirmInput = vaultFixture.nativeElement.querySelector(
        '[data-testid="confirm-password-input"]',
      ) as HTMLInputElement;
      confirmInput.value = 'newpassword123';
      confirmInput.dispatchEvent(new Event('input'));
      vaultFixture.detectChanges();

      // Submit via DOM
      const formDE = vaultFixture.debugElement.query(
        (el) =>
          el.nativeElement.getAttribute?.('data-testid') ===
          'reset-password-form',
      );
      formDE.triggerEventHandler('ngSubmit');
      vaultFixture.detectChanges();
      await vaultFixture.whenStable();

      await vi.waitFor(() =>
        expect(mockAuthSessionService.updatePassword).toHaveBeenCalledWith(
          'newpassword123',
        ),
      );
      expect(mockEncryptionApi.recover$).not.toHaveBeenCalled();
      expect(mockEncryptionApi.setupRecoveryKey$).not.toHaveBeenCalled();
      expect(mockClientKeyService.setDirectKey).not.toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/', 'dashboard']);
    });
  });

  describe('onSubmit - Existing user without recovery key (hasRecoveryKey=false)', () => {
    let noRecoveryFixture: ComponentFixture<ResetPassword>;

    beforeEach(async () => {
      mockEncryptionApi.getSalt$.mockReturnValue(
        of({
          salt: 'salt-value',
          kdfIterations: 100000,
          hasRecoveryKey: false,
        }),
      );

      noRecoveryFixture = TestBed.createComponent(ResetPassword);
      component = noRecoveryFixture.componentInstance;

      await vi.waitFor(() => expect(component['isSessionValid']()).toBe(true));
      noRecoveryFixture.detectChanges();

      mockAuthSessionService.updatePassword.mockResolvedValue({
        success: true,
      });
    });

    async function fillAndSubmitNoRecovery(): Promise<void> {
      const passwordInput = noRecoveryFixture.nativeElement.querySelector(
        '[data-testid="new-password-input"]',
      ) as HTMLInputElement;
      passwordInput.value = 'newpassword123';
      passwordInput.dispatchEvent(new Event('input'));

      const confirmInput = noRecoveryFixture.nativeElement.querySelector(
        '[data-testid="confirm-password-input"]',
      ) as HTMLInputElement;
      confirmInput.value = 'newpassword123';
      confirmInput.dispatchEvent(new Event('input'));
      noRecoveryFixture.detectChanges();

      const formDE = noRecoveryFixture.debugElement.query(
        (el) =>
          el.nativeElement.getAttribute?.('data-testid') ===
          'reset-password-form',
      );
      formDE.triggerEventHandler('ngSubmit');
      noRecoveryFixture.detectChanges();
      await noRecoveryFixture.whenStable();
    }

    it('should hide recovery key field', () => {
      const recoveryInput = noRecoveryFixture.nativeElement.querySelector(
        '[data-testid="recovery-key-input"]',
      );
      expect(recoveryInput).toBeFalsy();
    });

    it('should not call recover$ (no recovery key flow)', async () => {
      await fillAndSubmitNoRecovery();

      await vi.waitFor(() =>
        expect(mockEncryptionApi.recover$).not.toHaveBeenCalled(),
      );
    });

    it('should not call setupRecoveryKey$ (will happen in setup-vault-code)', async () => {
      await fillAndSubmitNoRecovery();

      await vi.waitFor(() =>
        expect(mockEncryptionApi.setupRecoveryKey$).not.toHaveBeenCalled(),
      );
    });

    it('should navigate to setup-vault-code instead of dashboard', async () => {
      const router = TestBed.inject(Router);
      const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await fillAndSubmitNoRecovery();

      await vi.waitFor(() =>
        expect(spy).toHaveBeenCalledWith(['/', 'setup-vault-code']),
      );
    });

    it('should call updatePassword with new password', async () => {
      await fillAndSubmitNoRecovery();

      await vi.waitFor(() =>
        expect(mockAuthSessionService.updatePassword).toHaveBeenCalledWith(
          'newpassword123',
        ),
      );
    });
  });

  describe('Salt fetch error handling', () => {
    it('should show error state when salt fetch fails', async () => {
      mockEncryptionApi.getSalt$.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const newFixture = TestBed.createComponent(ResetPassword);
      const newComponent = newFixture.componentInstance;

      await vi.waitFor(() =>
        expect(newComponent['saltFetchError']()).toBeTruthy(),
      );
      newFixture.detectChanges();

      const errorDiv = newFixture.nativeElement.querySelector(
        '[data-testid="salt-fetch-error"]',
      );
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.textContent).toContain(
        'Impossible de charger les informations de sécurité',
      );
      expect(newComponent['isSessionValid']()).toBe(false);
      expect(newComponent['isCheckingSession']()).toBe(false);
    });

    it('should distinguish salt fetch error from invalid session', async () => {
      mockEncryptionApi.getSalt$.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const newFixture = TestBed.createComponent(ResetPassword);
      const newComponent = newFixture.componentInstance;

      await vi.waitFor(() =>
        expect(newComponent['saltFetchError']()).toBeTruthy(),
      );
      newFixture.detectChanges();

      // Salt fetch error shows the salt-fetch-error div, not the invalid-link div
      expect(
        newFixture.nativeElement.querySelector(
          '[data-testid="salt-fetch-error"]',
        ),
      ).toBeTruthy();
      expect(
        newFixture.nativeElement.querySelector(
          '[data-testid="invalid-link-message"]',
        ),
      ).toBeFalsy();
      expect(newComponent['isSessionValid']()).toBe(false);
    });
  });
});
