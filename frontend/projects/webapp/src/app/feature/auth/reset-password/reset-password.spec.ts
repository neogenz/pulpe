import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
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
import { Logger } from '@core/logging/logger';

import ResetPassword from './reset-password';

describe('ResetPassword', () => {
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
        .mockReturnValue(of({ recoveryKey: 'ABCD-EFGH-1234-5678' })),
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

    component = TestBed.createComponent(ResetPassword).componentInstance;

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // Wait for session check AND salt fetch to complete
    await vi.waitFor(() => expect(component['isSessionValid']()).toBe(true));
  });

  function fillValidForm(): void {
    component['form'].patchValue({
      recoveryKey: 'ABCD-EFGH-1234-5678',
      newPassword: 'newpassword123',
      confirmPassword: 'newpassword123',
    });
  }

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have signal properties defined', () => {
      expect(component['isCheckingSession']).toBeDefined();
      expect(component['isSessionValid']).toBeDefined();
      expect(component['isSubmitting']).toBeDefined();
      expect(component['errorMessage']).toBeDefined();
      expect(component['isPasswordHidden']).toBeDefined();
      expect(component['isConfirmPasswordHidden']).toBeDefined();
    });

    it('should have form defined', () => {
      expect(component['form']).toBeDefined();
      expect(component['form'].get('recoveryKey')).toBeDefined();
      expect(component['form'].get('newPassword')).toBeDefined();
      expect(component['form'].get('confirmPassword')).toBeDefined();
    });

    it('should have computed canSubmit defined', () => {
      expect(component['canSubmit']).toBeDefined();
      expect(typeof component['canSubmit']).toBe('function');
    });
  });

  describe('Session Check (effect)', () => {
    it('should set isSessionValid to true when authenticated', () => {
      expect(component['isSessionValid']()).toBe(true);
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

    it('should set isCheckingSession to false after checking session', () => {
      expect(component['isCheckingSession']()).toBe(false);
    });
  });

  describe('Default Values', () => {
    it('should have isPasswordHidden true by default', () => {
      expect(component['isPasswordHidden']()).toBe(true);
    });

    it('should have isConfirmPasswordHidden true by default', () => {
      expect(component['isConfirmPasswordHidden']()).toBe(true);
    });

    it('should have isSubmitting false by default', () => {
      expect(component['isSubmitting']()).toBe(false);
    });

    it('should have errorMessage empty by default', () => {
      expect(component['errorMessage']()).toBe('');
    });

    it('should have isCheckingSession false after init', () => {
      expect(component['isCheckingSession']()).toBe(false);
    });

    it('should have isSessionValid true by default (authenticated)', () => {
      expect(component['isSessionValid']()).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should have recoveryKey field with required validator when hasRecoveryKey is true', () => {
      // When user has recovery key configured, the recovery key field is shown and required
      const recoveryKeyControl = component['form'].get('recoveryKey');
      recoveryKeyControl?.setValue('');
      expect(recoveryKeyControl?.hasError('required')).toBe(true);
    });

    it('should require newPassword', () => {
      const newPasswordControl = component['form'].get('newPassword');
      newPasswordControl?.setValue('');
      expect(newPasswordControl?.hasError('required')).toBe(true);
    });

    it('should validate newPassword minimum length', () => {
      const newPasswordControl = component['form'].get('newPassword');
      newPasswordControl?.setValue('short');
      expect(newPasswordControl?.hasError('minlength')).toBe(true);

      newPasswordControl?.setValue('longpassword');
      expect(newPasswordControl?.hasError('minlength')).toBe(false);
    });

    it('should use PASSWORD_MIN_LENGTH constant for validation', () => {
      const newPasswordControl = component['form'].get('newPassword');
      const shortPassword = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
      const validPassword = 'a'.repeat(PASSWORD_MIN_LENGTH);

      newPasswordControl?.setValue(shortPassword);
      expect(newPasswordControl?.hasError('minlength')).toBe(true);

      newPasswordControl?.setValue(validPassword);
      expect(newPasswordControl?.hasError('minlength')).toBe(false);
    });

    it('should require confirmPassword', () => {
      const confirmPasswordControl = component['form'].get('confirmPassword');
      confirmPasswordControl?.setValue('');
      expect(confirmPasswordControl?.hasError('required')).toBe(true);
    });

    it('should allow valid confirmPassword', () => {
      const confirmPasswordControl = component['form'].get('confirmPassword');
      confirmPasswordControl?.setValue('newpassword123');
      expect(confirmPasswordControl?.hasError('required')).toBe(false);
    });
  });

  describe('passwordsMatchValidator', () => {
    it('should return null when both fields are empty', () => {
      component['form'].get('newPassword')?.setValue('');
      component['form'].get('confirmPassword')?.setValue('');
      expect(component['form'].hasError('passwordsMismatch')).toBe(false);
    });

    it('should return null when passwords match', () => {
      component['form'].get('newPassword')?.setValue('newpassword123');
      component['form'].get('confirmPassword')?.setValue('newpassword123');
      expect(component['form'].hasError('passwordsMismatch')).toBe(false);
    });

    it('should return error when passwords do not match', () => {
      component['form'].get('newPassword')?.setValue('newpassword123');
      component['form'].get('confirmPassword')?.setValue('differentpassword');
      expect(component['form'].hasError('passwordsMismatch')).toBe(true);
    });

    it('should set passwordsMismatch error on confirmPassword control', () => {
      component['form'].get('newPassword')?.setValue('newpassword123');
      component['form'].get('confirmPassword')?.setValue('differentpassword');
      expect(
        component['form'].get('confirmPassword')?.hasError('passwordsMismatch'),
      ).toBe(true);
    });
  });

  describe('canSubmit computed', () => {
    it('should return false when form is invalid', () => {
      expect(component['canSubmit']()).toBe(false);
    });

    it('should return false when isSubmitting is true', () => {
      fillValidForm();
      component['isSubmitting'].set(true);
      expect(component['canSubmit']()).toBe(false);
    });

    it('should return true when form is valid and not submitting', () => {
      fillValidForm();
      expect(component['canSubmit']()).toBe(true);
    });
  });

  describe('clearError', () => {
    it('should reset errorMessage to empty string', () => {
      component['errorMessage'].set('Some error');
      component['clearError']();
      expect(component['errorMessage']()).toBe('');
    });
  });

  describe('onSubmit - Invalid Form', () => {
    it('should not submit when form is invalid', async () => {
      // getSalt$ is called on init, so reset the mock
      mockEncryptionApi.recover$.mockClear();

      await component['onSubmit']();

      // With invalid form, recover$ should not be called
      expect(mockEncryptionApi.recover$).not.toHaveBeenCalled();
    });

    it('should mark form as touched when invalid', async () => {
      const markAllAsTouchedSpy = vi.spyOn(
        component['form'],
        'markAllAsTouched',
      );

      await component['onSubmit']();

      expect(markAllAsTouchedSpy).toHaveBeenCalled();
    });
  });

  describe('onSubmit - Valid Form', () => {
    beforeEach(() => {
      fillValidForm();
      mockAuthSessionService.updatePassword.mockResolvedValue({
        success: true,
      });
    });

    it('should set isSubmitting to true when called', async () => {
      const promise = component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);

      await promise;
    });

    it('should clear error message before submitting', async () => {
      component['errorMessage'].set('Previous error');

      await component['onSubmit']();

      expect(component['errorMessage']()).toBe('');
    });

    it('should call getSalt$ to get encryption salt', async () => {
      await component['onSubmit']();

      expect(mockEncryptionApi.getSalt$).toHaveBeenCalled();
    });

    it('should call deriveClientKey with password and salt', async () => {
      await component['onSubmit']();

      expect(deriveClientKeySpy).toHaveBeenCalledWith(
        'newpassword123',
        'salt-value',
        100000,
      );
    });

    it('should call recover$ with recovery key and derived client key', async () => {
      await component['onSubmit']();

      expect(mockEncryptionApi.recover$).toHaveBeenCalledWith(
        'ABCD-EFGH-1234-5678',
        'abcd'.repeat(16),
      );
    });

    it('should call setDirectKey with derived client key', async () => {
      await component['onSubmit']();

      expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
        'abcd'.repeat(16),
      );
    });

    it('should call updatePassword with new password', async () => {
      await component['onSubmit']();

      expect(mockAuthSessionService.updatePassword).toHaveBeenCalledWith(
        'newpassword123',
      );
    });

    it('should call setupRecoveryKey$ after successful password update', async () => {
      await component['onSubmit']();

      expect(mockEncryptionApi.setupRecoveryKey$).toHaveBeenCalled();
    });

    it('should open recovery dialog after successful password update', async () => {
      await component['onSubmit']();

      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should navigate to dashboard after dialog closes', async () => {
      mockDialogRef.afterClosed.mockReturnValue(of(true));

      await component['onSubmit']();

      expect(navigateSpy).toHaveBeenCalledWith(['/', 'dashboard']);
    });

    it('should reset isSubmitting after onSubmit completes', async () => {
      await component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('onSubmit - recover$ failure', () => {
    beforeEach(() => {
      fillValidForm();
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

    it('should set recovery key error message on 400 response', async () => {
      await component['onSubmit']();

      expect(component['errorMessage']()).toContain(
        'Clé de récupération invalide',
      );
    });

    it('should not call setDirectKey on recover$ failure', async () => {
      await component['onSubmit']();

      expect(mockClientKeyService.setDirectKey).not.toHaveBeenCalled();
    });

    it('should have called updatePassword before recover$ fails', async () => {
      await component['onSubmit']();

      expect(mockAuthSessionService.updatePassword).toHaveBeenCalledWith(
        'newpassword123',
      );
    });

    it('should reset isSubmitting on recover$ failure', async () => {
      await component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('onSubmit - updatePassword failure', () => {
    beforeEach(() => {
      fillValidForm();
      mockAuthSessionService.updatePassword.mockResolvedValue({
        success: false,
        error: 'Password update failed',
      });
    });

    it('should set error message for password update failure', async () => {
      await component['onSubmit']();

      expect(component['errorMessage']()).toBeTruthy();
    });

    it('should not call recover$ when password update fails', async () => {
      await component['onSubmit']();

      expect(mockEncryptionApi.recover$).not.toHaveBeenCalled();
    });

    it('should reset isSubmitting on password update failure', async () => {
      await component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
    });

    it('should not navigate on password update failure', async () => {
      await component['onSubmit']();

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('onSubmit - Existing user without recovery key (hasRecoveryKey=false)', () => {
    beforeEach(async () => {
      // User without vault code AND without recovery key (existing user before migration)
      mockEncryptionApi.getSalt$.mockReturnValue(
        of({
          salt: 'salt-value',
          kdfIterations: 100000,
          hasRecoveryKey: false, // <-- No recovery key configured
        }),
      );

      // Recreate component with new mock
      const newFixture = TestBed.createComponent(ResetPassword);
      component = newFixture.componentInstance;

      // Wait for salt fetch to complete
      await vi.waitFor(() => expect(component['isSessionValid']()).toBe(true));

      // Fill form with just passwords (no recovery key needed)
      component['form'].patchValue({
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123',
      });

      mockAuthSessionService.updatePassword.mockResolvedValue({
        success: true,
      });
    });

    it('should have showRecoveryKeyField as false', () => {
      expect(component['showRecoveryKeyField']()).toBe(false);
    });

    it('should not call recover$ (no recovery key flow)', async () => {
      await component['onSubmit']();

      expect(mockEncryptionApi.recover$).not.toHaveBeenCalled();
    });

    it('should not call setupRecoveryKey$ (will happen in setup-vault-code)', async () => {
      await component['onSubmit']();

      expect(mockEncryptionApi.setupRecoveryKey$).not.toHaveBeenCalled();
    });

    it('should navigate to setup-vault-code instead of dashboard', async () => {
      const router = TestBed.inject(Router);
      const spy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await component['onSubmit']();

      expect(spy).toHaveBeenCalledWith(['/', 'setup-vault-code']);
    });

    it('should call updatePassword with new password', async () => {
      await component['onSubmit']();

      expect(mockAuthSessionService.updatePassword).toHaveBeenCalledWith(
        'newpassword123',
      );
    });
  });

  describe('Salt fetch error handling', () => {
    it('should show error state when salt fetch fails', async () => {
      // Reset the mock to throw an error BEFORE creating new component
      mockEncryptionApi.getSalt$.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const newFixture = TestBed.createComponent(ResetPassword);
      const newComponent = newFixture.componentInstance;

      // Wait for the error to be set (async fetch must complete)
      await vi.waitFor(() =>
        expect(newComponent['saltFetchError']()).toBeTruthy(),
      );

      expect(newComponent['saltFetchError']()).toBe(
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

      // Wait for the error to be set
      await vi.waitFor(() =>
        expect(newComponent['saltFetchError']()).toBeTruthy(),
      );

      // saltFetchError should be set, not just isSessionValid being false
      expect(newComponent['saltFetchError']()).toBeTruthy();
      // Session is considered invalid due to error, even though user is authenticated
      expect(newComponent['isSessionValid']()).toBe(false);
    });
  });
});
