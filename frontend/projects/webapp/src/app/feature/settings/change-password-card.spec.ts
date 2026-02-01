import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { AuthSessionService, PASSWORD_MIN_LENGTH } from '@core/auth';
import { ClientKeyService, EncryptionApi } from '@core/encryption';
import { Logger } from '@core/logging/logger';

const { mockDeriveClientKey } = vi.hoisted(() => ({
  mockDeriveClientKey: vi.fn().mockResolvedValue('a'.repeat(64)),
}));

vi.mock('@core/encryption/crypto.utils', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual: typeof import('@core/encryption/crypto.utils') =
    await importOriginal();
  return {
    ...actual,
    deriveClientKey: mockDeriveClientKey,
  };
});

import { ChangePasswordCard } from './change-password-card';

describe('ChangePasswordCard', () => {
  let component: ChangePasswordCard;
  let mockAuthSession: { updatePassword: ReturnType<typeof vi.fn> };
  let mockEncryptionApi: {
    getSalt$: ReturnType<typeof vi.fn>;
    notifyPasswordChange$: ReturnType<typeof vi.fn>;
    setupRecoveryKey$: ReturnType<typeof vi.fn>;
  };
  let mockClientKeyService: { setDirectKey: ReturnType<typeof vi.fn> };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockDialogRef: { afterClosed: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDialogRef = {
      afterClosed: vi.fn().mockReturnValue(of(true)),
    };

    mockAuthSession = {
      updatePassword: vi.fn().mockResolvedValue({ success: true }),
    };

    mockEncryptionApi = {
      getSalt$: vi
        .fn()
        .mockReturnValue(of({ salt: 'abc123', kdfIterations: 100000 })),
      notifyPasswordChange$: vi.fn().mockReturnValue(of({ success: true })),
      setupRecoveryKey$: vi
        .fn()
        .mockReturnValue(of({ recoveryKey: 'ABCD-EFGH-1234' })),
    };

    mockClientKeyService = {
      setDirectKey: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue(mockDialogRef),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ChangePasswordCard],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        { provide: AuthSessionService, useValue: mockAuthSession },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: ClientKeyService, useValue: mockClientKeyService },
        { provide: Logger, useValue: mockLogger },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    component = TestBed.createComponent(ChangePasswordCard).componentInstance;
  });

  function fillValidForm(): void {
    component.passwordForm.patchValue({
      newPassword: 'newpassword123',
      confirmPassword: 'newpassword123',
    });
  }

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have form defined', () => {
      expect(component.passwordForm).toBeDefined();
      expect(component.passwordForm.get('newPassword')).toBeDefined();
      expect(component.passwordForm.get('confirmPassword')).toBeDefined();
    });

    it('should have isChanging false by default', () => {
      expect(component.isChanging()).toBe(false);
    });

    it('should have errorMessage empty by default', () => {
      expect(component.errorMessage()).toBe('');
    });
  });

  describe('Form Validation', () => {
    it('should require new password', () => {
      const control = component.passwordForm.get('newPassword');
      control?.setValue('');
      expect(control?.hasError('required')).toBe(true);
    });

    it('should validate password minimum length', () => {
      const control = component.passwordForm.get('newPassword');
      const short = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
      control?.setValue(short);
      expect(control?.hasError('minlength')).toBe(true);

      const valid = 'a'.repeat(PASSWORD_MIN_LENGTH);
      control?.setValue(valid);
      expect(control?.hasError('minlength')).toBe(false);
    });

    it('should require confirm password', () => {
      const control = component.passwordForm.get('confirmPassword');
      control?.setValue('');
      expect(control?.hasError('required')).toBe(true);
    });

    it('should detect mismatched passwords via isFormValid', () => {
      component.passwordForm.patchValue({
        newPassword: 'password123',
        confirmPassword: 'different456',
      });
      expect(component['isFormValid']()).toBe(false);
    });

    it('should accept matching valid passwords via isFormValid', () => {
      fillValidForm();
      expect(component['isFormValid']()).toBe(true);
    });
  });

  describe('Password Change Flow', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should call authSession.updatePassword with new password', async () => {
      await component['onChangePassword']();

      expect(mockAuthSession.updatePassword).toHaveBeenCalledWith(
        'newpassword123',
      );
    });

    it('should call getSalt$ after successful Supabase update', async () => {
      await component['onChangePassword']();

      expect(mockEncryptionApi.getSalt$).toHaveBeenCalled();
    });

    it('should call notifyPasswordChange$ after deriving new key', async () => {
      await component['onChangePassword']();

      expect(mockEncryptionApi.notifyPasswordChange$).toHaveBeenCalledWith(
        expect.any(String),
      );
    });

    it('should update clientKeyService with new key after rekey', async () => {
      await component['onChangePassword']();

      expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
        expect.any(String),
      );
    });

    it('should show success snackbar after password change', async () => {
      await component['onChangePassword']();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Mot de passe modifié',
        'OK',
        expect.objectContaining({ duration: 3000 }),
      );
    });

    it('should reset form after successful change', async () => {
      await component['onChangePassword']();

      expect(component.passwordForm.get('newPassword')?.value).toBe('');
      expect(component.passwordForm.get('confirmPassword')?.value).toBe('');
    });

    it('should set isChanging during the flow', async () => {
      expect(component.isChanging()).toBe(false);

      const promise = component['onChangePassword']();
      expect(component.isChanging()).toBe(true);

      await promise;
      expect(component.isChanging()).toBe(false);
    });
  });

  describe('Recovery Key Nudge', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should call setupRecoveryKey$ after successful password change', async () => {
      await component['onChangePassword']();

      expect(mockEncryptionApi.setupRecoveryKey$).toHaveBeenCalled();
    });

    it('should open RecoveryKeyDialog with disableClose', async () => {
      await component['onChangePassword']();

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: { recoveryKey: 'ABCD-EFGH-1234' },
          width: '480px',
          disableClose: true,
        }),
      );
    });

    it('should show snackbar when user confirms recovery key', async () => {
      mockDialogRef.afterClosed.mockReturnValue(of(true));

      await component['onChangePassword']();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Clé de récupération enregistrée',
        'OK',
        expect.objectContaining({ duration: 3000 }),
      );
    });

    it('should not crash if recovery key setup fails', async () => {
      mockEncryptionApi.setupRecoveryKey$.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      await component['onChangePassword']();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Recovery key setup failed after password change — user can generate later from settings',
        expect.any(Error),
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Mot de passe modifié',
        'OK',
        expect.any(Object),
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should show error when Supabase update fails', async () => {
      mockAuthSession.updatePassword.mockResolvedValue({
        success: false,
        error: 'Mot de passe trop faible',
      });

      await component['onChangePassword']();

      expect(component.errorMessage()).toBe('Mot de passe trop faible');
      expect(mockEncryptionApi.getSalt$).not.toHaveBeenCalled();
    });

    it('should show error when notifyPasswordChange fails', async () => {
      mockEncryptionApi.notifyPasswordChange$.mockReturnValue(
        throwError(() => new Error('Rekey failed')),
      );

      await component['onChangePassword']();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Password change failed',
        expect.any(Error),
      );
      expect(component.errorMessage()).toBe(
        'Le changement de mot de passe a échoué — réessaie plus tard',
      );
    });

    it('should not call setupRecoveryKey$ when Supabase update fails', async () => {
      mockAuthSession.updatePassword.mockResolvedValue({
        success: false,
        error: 'Error',
      });

      await component['onChangePassword']();

      expect(mockEncryptionApi.setupRecoveryKey$).not.toHaveBeenCalled();
    });

    it('should not proceed when passwords differ', async () => {
      component.passwordForm.patchValue({
        newPassword: 'password123',
        confirmPassword: 'different456',
      });

      await component['onChangePassword']();

      expect(mockAuthSession.updatePassword).not.toHaveBeenCalled();
    });

    it('should prevent double submission', async () => {
      component.isChanging.set(true);

      await component['onChangePassword']();

      expect(mockAuthSession.updatePassword).not.toHaveBeenCalled();
    });
  });
});
