import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { AuthSessionService } from '@core/auth';
import { ClientKeyService, EncryptionApi } from '@core/encryption';
import * as cryptoUtils from '@core/encryption/crypto.utils';
import { Logger } from '@core/logging/logger';

import SetupVaultCode from './setup-vault-code';

describe('SetupVaultCode', () => {
  let component: SetupVaultCode;
  let mockUpdateUser: ReturnType<typeof vi.fn>;
  let mockSignOut: ReturnType<typeof vi.fn>;
  let mockAuthSessionService: {
    getClient: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  let mockClientKeyService: {
    setDirectKey: ReturnType<typeof vi.fn>;
  };
  let mockEncryptionApi: {
    getSalt$: ReturnType<typeof vi.fn>;
    setupRecoveryKey$: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockLogger: { error: ReturnType<typeof vi.fn> };
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

    mockUpdateUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    mockSignOut = vi.fn().mockResolvedValue(undefined);
    mockAuthSessionService = {
      getClient: vi.fn().mockReturnValue({
        auth: { updateUser: mockUpdateUser },
      }),
      signOut: mockSignOut,
    };

    mockClientKeyService = {
      setDirectKey: vi.fn(),
    };

    mockEncryptionApi = {
      getSalt$: vi
        .fn()
        .mockReturnValue(of({ salt: 'salt-value', kdfIterations: 100000 })),
      setupRecoveryKey$: vi
        .fn()
        .mockReturnValue(of({ recoveryKey: 'ABCD-EFGH-IJKL-MNOP' })),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue(mockDialogRef),
    };

    mockLogger = {
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SetupVaultCode],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: AuthSessionService, useValue: mockAuthSessionService },
        { provide: ClientKeyService, useValue: mockClientKeyService },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: MatDialog, useValue: mockDialog },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compileComponents();

    component = TestBed.createComponent(SetupVaultCode).componentInstance;

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  function fillValidForm(): void {
    component['form'].patchValue({
      vaultCode: '123456',
      confirmCode: '123456',
      rememberDevice: false,
    });
  }

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have form defined with vaultCode, confirmCode, and rememberDevice', () => {
      expect(component['form']).toBeDefined();
      expect(component['form'].get('vaultCode')).toBeDefined();
      expect(component['form'].get('confirmCode')).toBeDefined();
      expect(component['form'].get('rememberDevice')).toBeDefined();
    });
  });

  describe('Form Validation', () => {
    it('should require vaultCode', () => {
      const control = component['form'].get('vaultCode');
      control?.setValue('');
      expect(control?.hasError('required')).toBe(true);
    });

    it('should validate vaultCode minimum length of 4', () => {
      const control = component['form'].get('vaultCode');
      control?.setValue('12');
      expect(control?.hasError('minlength')).toBe(true);

      control?.setValue('1234');
      expect(control?.hasError('minlength')).toBe(false);
    });

    it('should reject non-numeric vaultCode', () => {
      const control = component['form'].get('vaultCode');
      control?.setValue('abcd');
      expect(control?.hasError('pattern')).toBe(true);

      control?.setValue('1234');
      expect(control?.hasError('pattern')).toBe(false);
    });

    it('should require confirmCode', () => {
      const control = component['form'].get('confirmCode');
      control?.setValue('');
      expect(control?.hasError('required')).toBe(true);
    });

    it('should require matching vault codes', () => {
      component['form'].get('vaultCode')?.setValue('123456');
      component['form'].get('confirmCode')?.setValue('654321');
      expect(component['form'].hasError('fieldsMismatch')).toBe(true);
    });

    it('should allow matching vault codes', () => {
      component['form'].get('vaultCode')?.setValue('123456');
      component['form'].get('confirmCode')?.setValue('123456');
      expect(component['form'].hasError('fieldsMismatch')).toBe(false);
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

  describe('onSubmit - Valid Form', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should call getSalt$ to get encryption salt', async () => {
      await component['onSubmit']();
      expect(mockEncryptionApi.getSalt$).toHaveBeenCalled();
    });

    it('should call deriveClientKey with vault code and salt', async () => {
      await component['onSubmit']();
      expect(deriveClientKeySpy).toHaveBeenCalledWith(
        '123456',
        'salt-value',
        100000,
      );
    });

    it('should call setDirectKey with derived client key and rememberDevice flag', async () => {
      await component['onSubmit']();
      expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
        'abcd'.repeat(16),
        false,
      );
    });

    it('should call updateUser to set vaultCodeConfigured', async () => {
      await component['onSubmit']();
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { vaultCodeConfigured: true },
      });
    });

    it('should call setupRecoveryKey$ after successful setup', async () => {
      await component['onSubmit']();
      expect(mockEncryptionApi.setupRecoveryKey$).toHaveBeenCalled();
    });

    it('should open recovery dialog after successful setup', async () => {
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

    it('should use localStorage when rememberDevice is checked', async () => {
      component['form'].patchValue({ rememberDevice: true });
      await component['onSubmit']();
      expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
        'abcd'.repeat(16),
        true,
      );
    });
  });

  describe('onSubmit - Error Handling', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should not submit when form is invalid', async () => {
      component['form'].patchValue({ vaultCode: '', confirmCode: '' });
      await component['onSubmit']();
      expect(mockEncryptionApi.getSalt$).not.toHaveBeenCalled();
    });

    it('should set error message on submission failure', async () => {
      vi.spyOn(mockEncryptionApi, 'getSalt$').mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      await component['onSubmit']();
      expect(component['errorMessage']()).toContain(
        "Quelque chose n'a pas fonctionné",
      );
    });

    it('should reset isSubmitting on error', async () => {
      vi.spyOn(mockEncryptionApi, 'getSalt$').mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      await component['onSubmit']();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('onSubmit - Partial failure chains', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should not mark vaultCodeConfigured when setupRecoveryKey$ fails', async () => {
      mockEncryptionApi.setupRecoveryKey$.mockReturnValue(
        throwError(() => new Error('Recovery setup failed')),
      );

      await component['onSubmit']();

      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('should not navigate when updateUser fails', async () => {
      mockUpdateUser.mockRejectedValue(new Error('Update failed'));

      await component['onSubmit']();

      expect(navigateSpy).not.toHaveBeenCalled();
      expect(component['errorMessage']()).toContain(
        "Quelque chose n'a pas fonctionné",
      );
    });

    it('should not call setupRecoveryKey when setDirectKey throws', async () => {
      mockClientKeyService.setDirectKey.mockImplementation(() => {
        throw new Error('Invalid client key hex');
      });

      await component['onSubmit']();

      expect(mockEncryptionApi.setupRecoveryKey$).not.toHaveBeenCalled();
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });
  });

  describe('onLogout', () => {
    it('should not proceed if already logging out', async () => {
      component['isLoggingOut'].set(true);

      await component['onLogout']();

      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('should set isLoggingOut to true when starting logout', async () => {
      const promise = component['onLogout']();

      expect(component['isLoggingOut']()).toBe(true);

      await promise;
    });

    it('should open LogoutDialog with disableClose', async () => {
      await component['onLogout']();

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ disableClose: true }),
      );
    });

    it('should call authSessionService.signOut', async () => {
      await component['onLogout']();

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should reset isLoggingOut on signOut success', async () => {
      await component['onLogout']();

      expect(component['isLoggingOut']()).toBe(false);
    });

    it('should reset isLoggingOut on signOut error', async () => {
      mockSignOut.mockRejectedValue(new Error('Logout failed'));

      await component['onLogout']();

      expect(component['isLoggingOut']()).toBe(false);
    });

    it('should log error when signOut fails', async () => {
      const error = new Error('Logout failed');
      mockSignOut.mockRejectedValue(error);

      await component['onLogout']();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Erreur lors de la déconnexion:',
        error,
      );
    });
  });
});
