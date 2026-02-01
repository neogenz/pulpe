import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { AuthCredentialsService, PASSWORD_MIN_LENGTH } from '@core/auth';
import { EncryptionApi } from '@core/encryption';
import { Logger } from '@core/logging/logger';

import Signup from './signup';

describe('Signup', () => {
  let component: Signup;
  let mockAuthCredentials: { signUpWithEmail: ReturnType<typeof vi.fn> };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockEncryptionApi: {
    setupRecoveryKey$: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockDialogRef: { afterClosed: ReturnType<typeof vi.fn> };
  let navigateSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockDialogRef = {
      afterClosed: vi.fn().mockReturnValue(of(true)),
    };

    mockAuthCredentials = {
      signUpWithEmail: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
    };

    mockEncryptionApi = {
      setupRecoveryKey$: vi
        .fn()
        .mockReturnValue(of({ recoveryKey: 'ABCD-EFGH-1234' })),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue(mockDialogRef),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Signup],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: AuthCredentialsService, useValue: mockAuthCredentials },
        { provide: Logger, useValue: mockLogger },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    component = TestBed.createComponent(Signup).componentInstance;

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  function fillValidForm(): void {
    component['signupForm'].patchValue({
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      acceptTerms: true,
    });
  }

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have signal properties defined', () => {
      expect(component['hidePassword']).toBeDefined();
      expect(component['hideConfirmPassword']).toBeDefined();
      expect(component['isSubmitting']).toBeDefined();
      expect(component['errorMessage']).toBeDefined();
    });

    it('should have form defined', () => {
      expect(component['signupForm']).toBeDefined();
      expect(component['signupForm'].get('email')).toBeDefined();
      expect(component['signupForm'].get('password')).toBeDefined();
      expect(component['signupForm'].get('confirmPassword')).toBeDefined();
      expect(component['signupForm'].get('acceptTerms')).toBeDefined();
    });

    it('should have computed canSubmit defined', () => {
      expect(component['canSubmit']).toBeDefined();
      expect(typeof component['canSubmit']).toBe('function');
    });
  });

  describe('Default Values', () => {
    it('should have hidePassword true by default', () => {
      expect(component['hidePassword']()).toBe(true);
    });

    it('should have hideConfirmPassword true by default', () => {
      expect(component['hideConfirmPassword']()).toBe(true);
    });

    it('should have isSubmitting false by default', () => {
      expect(component['isSubmitting']()).toBe(false);
    });

    it('should have errorMessage empty by default', () => {
      expect(component['errorMessage']()).toBe('');
    });
  });

  describe('Form Validation', () => {
    it('should require email', () => {
      const emailControl = component['signupForm'].get('email');
      emailControl?.setValue('');
      expect(emailControl?.hasError('required')).toBe(true);
    });

    it('should validate email format', () => {
      const emailControl = component['signupForm'].get('email');
      emailControl?.setValue('invalid-email');
      expect(emailControl?.hasError('email')).toBe(true);

      emailControl?.setValue('valid@email.com');
      expect(emailControl?.hasError('email')).toBe(false);
    });

    it('should require password', () => {
      const passwordControl = component['signupForm'].get('password');
      passwordControl?.setValue('');
      expect(passwordControl?.hasError('required')).toBe(true);
    });

    it('should validate password minimum length', () => {
      const passwordControl = component['signupForm'].get('password');
      passwordControl?.setValue('short');
      expect(passwordControl?.hasError('minlength')).toBe(true);

      passwordControl?.setValue('longpassword');
      expect(passwordControl?.hasError('minlength')).toBe(false);
    });

    it('should use PASSWORD_MIN_LENGTH constant for validation', () => {
      const passwordControl = component['signupForm'].get('password');
      const shortPassword = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
      const validPassword = 'a'.repeat(PASSWORD_MIN_LENGTH);

      passwordControl?.setValue(shortPassword);
      expect(passwordControl?.hasError('minlength')).toBe(true);

      passwordControl?.setValue(validPassword);
      expect(passwordControl?.hasError('minlength')).toBe(false);
    });

    it('should require confirmPassword', () => {
      const confirmPasswordControl =
        component['signupForm'].get('confirmPassword');
      confirmPasswordControl?.setValue('');
      expect(confirmPasswordControl?.hasError('required')).toBe(true);
    });

    it('should require acceptTerms to be true', () => {
      const acceptTermsControl = component['signupForm'].get('acceptTerms');
      acceptTermsControl?.setValue(false);
      expect(acceptTermsControl?.hasError('required')).toBe(true);

      acceptTermsControl?.setValue(true);
      expect(acceptTermsControl?.hasError('required')).toBe(false);
    });
  });

  describe('passwordsMatchValidator', () => {
    it('should return null when both fields are empty', () => {
      component['signupForm'].get('password')?.setValue('');
      component['signupForm'].get('confirmPassword')?.setValue('');
      expect(component['signupForm'].hasError('passwordsMismatch')).toBe(false);
    });

    it('should return null when passwords match', () => {
      component['signupForm'].get('password')?.setValue('password123');
      component['signupForm'].get('confirmPassword')?.setValue('password123');
      expect(component['signupForm'].hasError('passwordsMismatch')).toBe(false);
    });

    it('should return error when passwords do not match', () => {
      component['signupForm'].get('password')?.setValue('password123');
      component['signupForm']
        .get('confirmPassword')
        ?.setValue('differentpassword');
      expect(component['signupForm'].hasError('passwordsMismatch')).toBe(true);
    });

    it('should set passwordsMismatch error on confirmPassword control', () => {
      component['signupForm'].get('password')?.setValue('password123');
      component['signupForm']
        .get('confirmPassword')
        ?.setValue('differentpassword');
      expect(
        component['signupForm']
          .get('confirmPassword')
          ?.hasError('passwordsMismatch'),
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

  describe('togglePasswordVisibility', () => {
    it('should toggle hidePassword from true to false', () => {
      expect(component['hidePassword']()).toBe(true);
      component['togglePasswordVisibility']();
      expect(component['hidePassword']()).toBe(false);
    });

    it('should toggle hidePassword from false to true', () => {
      component['hidePassword'].set(false);
      component['togglePasswordVisibility']();
      expect(component['hidePassword']()).toBe(true);
    });
  });

  describe('toggleConfirmPasswordVisibility', () => {
    it('should toggle hideConfirmPassword from true to false', () => {
      expect(component['hideConfirmPassword']()).toBe(true);
      component['toggleConfirmPasswordVisibility']();
      expect(component['hideConfirmPassword']()).toBe(false);
    });

    it('should toggle hideConfirmPassword from false to true', () => {
      component['hideConfirmPassword'].set(false);
      component['toggleConfirmPasswordVisibility']();
      expect(component['hideConfirmPassword']()).toBe(true);
    });
  });

  describe('clearMessages', () => {
    it('should reset errorMessage to empty string', () => {
      component['errorMessage'].set('Some error');
      component['clearMessages']();
      expect(component['errorMessage']()).toBe('');
    });
  });

  describe('signUp - Invalid Form', () => {
    it('should not submit when form is invalid', async () => {
      await component['signUp']();
      expect(mockAuthCredentials.signUpWithEmail).not.toHaveBeenCalled();
    });

    it('should mark form as touched when invalid', async () => {
      const markAllAsTouchedSpy = vi.spyOn(
        component['signupForm'],
        'markAllAsTouched',
      );

      await component['signUp']();

      expect(markAllAsTouchedSpy).toHaveBeenCalled();
    });

    it('should set error message when form is invalid', async () => {
      await component['signUp']();
      expect(component['errorMessage']()).toBe(
        'Quelques champs à vérifier avant de continuer',
      );
    });
  });

  describe('signUp - Valid Form', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should set isSubmitting to true when called', async () => {
      mockAuthCredentials.signUpWithEmail.mockResolvedValue({ success: true });

      const promise = component['signUp']();
      expect(component['isSubmitting']()).toBe(true);

      await promise;
    });

    it('should clear error message before submitting', async () => {
      component['errorMessage'].set('Previous error');
      mockAuthCredentials.signUpWithEmail.mockResolvedValue({ success: true });

      await component['signUp']();

      expect(component['errorMessage']()).toBe('');
    });

    it('should call authService.signUpWithEmail with correct params', async () => {
      mockAuthCredentials.signUpWithEmail.mockResolvedValue({ success: true });

      await component['signUp']();

      expect(mockAuthCredentials.signUpWithEmail).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
    });

    it('should reset isSubmitting after signUp completes (finally block)', async () => {
      mockAuthCredentials.signUpWithEmail.mockResolvedValue({ success: true });

      await component['signUp']();

      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('signUp - API Failure', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should set error message from API response', async () => {
      mockAuthCredentials.signUpWithEmail.mockResolvedValue({
        success: false,
        error: 'Email déjà utilisé',
      });

      await component['signUp']();

      expect(component['errorMessage']()).toBe('Email déjà utilisé');
    });

    it('should set default error message when no error in response', async () => {
      mockAuthCredentials.signUpWithEmail.mockResolvedValue({ success: false });

      await component['signUp']();

      expect(component['errorMessage']()).toBe(
        'La création du compte a échoué — on réessaie ?',
      );
    });

    it('should reset isSubmitting on failure', async () => {
      mockAuthCredentials.signUpWithEmail.mockResolvedValue({ success: false });

      await component['signUp']();

      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('signUp - Exception', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should set generic error message on exception', async () => {
      mockAuthCredentials.signUpWithEmail.mockRejectedValue(
        new Error('Network error'),
      );

      await component['signUp']();

      expect(component['errorMessage']()).toBe(
        "Quelque chose n'a pas fonctionné — réessayons",
      );
    });

    it('should log error on exception', async () => {
      const error = new Error('Network error');
      mockAuthCredentials.signUpWithEmail.mockRejectedValue(error);

      await component['signUp']();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Erreur lors de la création du compte:',
        error,
      );
    });

    it('should reset isSubmitting on exception', async () => {
      mockAuthCredentials.signUpWithEmail.mockRejectedValue(
        new Error('Network error'),
      );

      await component['signUp']();

      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('Recovery Key Prompt after Signup', () => {
    beforeEach(() => {
      fillValidForm();
      mockAuthCredentials.signUpWithEmail.mockResolvedValue({ success: true });
    });

    it('should call setupRecoveryKey$ after successful signup', async () => {
      await component['signUp']();

      expect(mockEncryptionApi.setupRecoveryKey$).toHaveBeenCalled();
    });

    it('should open RecoveryKeyDialog with disableClose after successful signup', async () => {
      await component['signUp']();

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: { recoveryKey: 'ABCD-EFGH-1234' },
          width: '480px',
          disableClose: true,
        }),
      );
    });

    it('should navigate to dashboard after recovery key dialog closes', async () => {
      mockDialogRef.afterClosed.mockReturnValue(of(true));

      await component['signUp']();

      expect(navigateSpy).toHaveBeenCalledWith(['/', 'dashboard']);
    });

    it('should show snackbar when user confirms recovery key', async () => {
      mockDialogRef.afterClosed.mockReturnValue(of(true));

      await component['signUp']();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Clé de récupération enregistrée',
        'OK',
        expect.objectContaining({ duration: 3000 }),
      );
    });

    it('should not show snackbar when user dismisses dialog without confirming', async () => {
      mockDialogRef.afterClosed.mockReturnValue(of(false));

      await component['signUp']();

      expect(mockSnackBar.open).not.toHaveBeenCalled();
    });

    it('should navigate to dashboard even if recovery key setup fails', async () => {
      mockEncryptionApi.setupRecoveryKey$.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      await component['signUp']();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Recovery key setup failed during signup — user can generate later from settings',
        expect.any(Error),
      );
      expect(navigateSpy).toHaveBeenCalledWith(['/', 'dashboard']);
    });

    it('should not call setupRecoveryKey$ when signup fails', async () => {
      mockAuthCredentials.signUpWithEmail.mockResolvedValue({
        success: false,
        error: 'Email already exists',
      });

      await component['signUp']();

      expect(mockEncryptionApi.setupRecoveryKey$).not.toHaveBeenCalled();
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
