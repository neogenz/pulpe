import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { DeleteAccountDialog } from './delete-account-dialog';
import { Logger } from '@core/logging/logger';
import { AuthSessionService, AuthStateService } from '@core/auth';
import { EncryptionApi } from '@core/encryption';

const { deriveClientKeyMock } = vi.hoisted(() => ({
  deriveClientKeyMock: vi.fn(),
}));

vi.mock('@core/encryption', async () => {
  const actual = await vi.importActual('@core/encryption');
  return {
    ...actual,
    deriveClientKey: deriveClientKeyMock,
  };
});

describe('DeleteAccountDialog', () => {
  let component: DeleteAccountDialog;
  let mockDialogRef: { close: Mock };
  let mockAuthSession: { verifyPassword: Mock };
  let mockAuthState: { isOAuthOnly: ReturnType<typeof signal<boolean>> };
  let mockEncryptionApi: { getSalt$: Mock; validateKey$: Mock };
  let mockLogger: { debug: Mock; info: Mock; warn: Mock; error: Mock };

  function setup(isOAuth: boolean) {
    mockDialogRef = { close: vi.fn() };
    mockAuthSession = { verifyPassword: vi.fn() };
    mockAuthState = { isOAuthOnly: signal(isOAuth) };
    mockEncryptionApi = {
      getSalt$: vi.fn(),
      validateKey$: vi.fn(),
    };
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        DeleteAccountDialog,
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: AuthSessionService, useValue: mockAuthSession },
        { provide: AuthStateService, useValue: mockAuthState },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    component = TestBed.inject(DeleteAccountDialog);
  }

  describe('OAuth user', () => {
    beforeEach(() => {
      setup(true);
    });

    it('should expose isOAuthOnly as true', () => {
      expect(component['isOAuthOnly']()).toBe(true);
    });

    it('should have vault code form control', () => {
      expect(component['vaultCodeForm'].get('vaultCode')).toBeTruthy();
    });

    it('should have invalid vault code form when empty', () => {
      expect(component['vaultCodeForm'].valid).toBe(false);
    });

    it('should have valid vault code form with numeric PIN', () => {
      component['vaultCodeForm'].patchValue({ vaultCode: '123456' });
      expect(component['vaultCodeForm'].valid).toBe(true);
    });

    it('should reject non-numeric vault code', () => {
      component['vaultCodeForm'].patchValue({ vaultCode: 'abcd' });
      expect(
        component['vaultCodeForm'].get('vaultCode')?.hasError('pattern'),
      ).toBe(true);
    });

    it('should close dialog with true on correct vault code', async () => {
      mockEncryptionApi.getSalt$.mockReturnValue(
        of({ salt: 'test-salt', kdfIterations: 100000 }),
      );
      deriveClientKeyMock.mockResolvedValue('test-client-key-hex');
      mockEncryptionApi.validateKey$.mockReturnValue(of(undefined));

      component['vaultCodeForm'].patchValue({ vaultCode: '123456' });

      await component['onSubmit']();

      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('should show error message on incorrect vault code', async () => {
      mockEncryptionApi.getSalt$.mockReturnValue(
        of({ salt: 'test-salt', kdfIterations: 100000 }),
      );
      deriveClientKeyMock.mockResolvedValue('test-client-key-hex');
      mockEncryptionApi.validateKey$.mockReturnValue(
        throwError(() => new Error('Invalid key')),
      );

      component['vaultCodeForm'].patchValue({ vaultCode: '999999' });

      await component['onSubmit']();

      expect(component['errorMessage']()).toBe(
        'Code PIN incorrect ou clé de chiffrement invalide',
      );
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should not call verifyPassword for OAuth user', async () => {
      mockEncryptionApi.getSalt$.mockReturnValue(
        of({ salt: 'test-salt', kdfIterations: 100000 }),
      );
      deriveClientKeyMock.mockResolvedValue('test-client-key-hex');
      mockEncryptionApi.validateKey$.mockReturnValue(of(undefined));

      component['vaultCodeForm'].patchValue({ vaultCode: '123456' });

      await component['onSubmit']();

      expect(mockAuthSession.verifyPassword).not.toHaveBeenCalled();
    });

    it('should not submit when already submitting', async () => {
      component['isSubmitting'].set(true);
      component['vaultCodeForm'].patchValue({ vaultCode: '123456' });

      await component['onSubmit']();

      expect(mockEncryptionApi.getSalt$).not.toHaveBeenCalled();
    });
  });

  describe('Email user', () => {
    beforeEach(() => {
      setup(false);
    });

    it('should expose isOAuthOnly as false', () => {
      expect(component['isOAuthOnly']()).toBe(false);
    });

    it('should have password form control', () => {
      expect(component['deleteForm'].get('password')).toBeTruthy();
    });

    it('should have invalid password form when empty', () => {
      expect(component['deleteForm'].valid).toBe(false);
    });

    it('should close dialog with true on correct password', async () => {
      mockAuthSession.verifyPassword.mockResolvedValue({ success: true });

      component['deleteForm'].patchValue({ password: 'correctPass123' });

      await component['onSubmit']();

      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('should set incorrect error on wrong password', async () => {
      mockAuthSession.verifyPassword.mockResolvedValue({
        success: false,
        error: 'Mot de passe incorrect',
      });

      component['deleteForm'].patchValue({ password: 'wrongPass123' });

      await component['onSubmit']();

      expect(
        component['deleteForm'].get('password')?.hasError('incorrect'),
      ).toBe(true);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should not call validateKey$ for email user', async () => {
      mockAuthSession.verifyPassword.mockResolvedValue({ success: true });

      component['deleteForm'].patchValue({ password: 'correctPass123' });

      await component['onSubmit']();

      expect(mockEncryptionApi.validateKey$).not.toHaveBeenCalled();
    });

    it('should not submit when already submitting', async () => {
      component['isSubmitting'].set(true);
      component['deleteForm'].patchValue({ password: 'correctPass123' });

      await component['onSubmit']();

      expect(mockAuthSession.verifyPassword).not.toHaveBeenCalled();
    });

    it('should show generic error on unexpected failure', async () => {
      mockAuthSession.verifyPassword.mockRejectedValue(
        new Error('Network error'),
      );

      component['deleteForm'].patchValue({ password: 'correctPass123' });

      await component['onSubmit']();

      expect(component['errorMessage']()).toBe(
        'La vérification a échoué — réessaie plus tard',
      );
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });
});
