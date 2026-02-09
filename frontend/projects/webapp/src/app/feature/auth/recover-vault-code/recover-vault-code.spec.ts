import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { ClientKeyService, EncryptionApi } from '@core/encryption';
import * as cryptoUtils from '@core/encryption/crypto.utils';
import { Logger } from '@core/logging/logger';

import RecoverVaultCode from './recover-vault-code';

describe('RecoverVaultCode', () => {
  let component: RecoverVaultCode;
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

    mockClientKeyService = {
      setDirectKey: vi.fn(),
    };

    mockEncryptionApi = {
      getSalt$: vi
        .fn()
        .mockReturnValue(of({ salt: 'salt-value', kdfIterations: 100000 })),
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
      imports: [RecoverVaultCode],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: ClientKeyService, useValue: mockClientKeyService },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: MatDialog, useValue: mockDialog },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compileComponents();

    component = TestBed.createComponent(RecoverVaultCode).componentInstance;

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  function fillValidForm(): void {
    component['form'].patchValue({
      recoveryKey: 'ABCD-EFGH-IJKL-MNOP',
      newVaultCode: 'newvaultcode123',
      confirmCode: 'newvaultcode123',
    });
  }

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have form defined with recovery and vault code fields', () => {
      expect(component['form']).toBeDefined();
      expect(component['form'].get('recoveryKey')).toBeDefined();
      expect(component['form'].get('newVaultCode')).toBeDefined();
      expect(component['form'].get('confirmCode')).toBeDefined();
    });
  });

  describe('Form Validation', () => {
    it('should require recoveryKey', () => {
      const control = component['form'].get('recoveryKey');
      control?.setValue('');
      expect(control?.hasError('required')).toBe(true);
    });

    it('should allow valid recoveryKey', () => {
      const control = component['form'].get('recoveryKey');
      control?.setValue('ABCD-EFGH-IJKL-MNOP');
      expect(control?.hasError('required')).toBe(false);
    });

    it('should require newVaultCode', () => {
      const control = component['form'].get('newVaultCode');
      control?.setValue('');
      expect(control?.hasError('required')).toBe(true);
    });

    it('should validate newVaultCode minimum length of 8', () => {
      const control = component['form'].get('newVaultCode');
      control?.setValue('short');
      expect(control?.hasError('minlength')).toBe(true);

      control?.setValue('validcode123');
      expect(control?.hasError('minlength')).toBe(false);
    });

    it('should require confirmCode', () => {
      const control = component['form'].get('confirmCode');
      control?.setValue('');
      expect(control?.hasError('required')).toBe(true);
    });

    it('should require matching vault codes', () => {
      component['form'].get('newVaultCode')?.setValue('vaultcode123');
      component['form'].get('confirmCode')?.setValue('different123');
      expect(component['form'].hasError('fieldsMismatch')).toBe(true);
    });

    it('should allow matching vault codes', () => {
      component['form'].get('newVaultCode')?.setValue('vaultcode123');
      component['form'].get('confirmCode')?.setValue('vaultcode123');
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

    it('should call deriveClientKey with new vault code and salt', async () => {
      await component['onSubmit']();
      expect(deriveClientKeySpy).toHaveBeenCalledWith(
        'newvaultcode123',
        'salt-value',
        100000,
      );
    });

    it('should call recover$ with recovery key and derived client key', async () => {
      await component['onSubmit']();
      expect(mockEncryptionApi.recover$).toHaveBeenCalledWith(
        'ABCD-EFGH-IJKL-MNOP',
        'abcd'.repeat(16),
      );
    });

    it('should call setDirectKey with derived client key', async () => {
      await component['onSubmit']();
      expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
        'abcd'.repeat(16),
        false,
      );
    });

    it('should call setupRecoveryKey$ after successful recovery', async () => {
      await component['onSubmit']();
      expect(mockEncryptionApi.setupRecoveryKey$).toHaveBeenCalled();
    });

    it('should open recovery dialog after successful recovery', async () => {
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

  describe('onSubmit - Error Handling', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should not submit when form is invalid', async () => {
      component['form'].patchValue({ recoveryKey: '' });
      await component['onSubmit']();
      expect(mockEncryptionApi.getSalt$).not.toHaveBeenCalled();
    });

    it('should set specific error message on 400 response (invalid recovery key)', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }),
        ),
      );
      await component['onSubmit']();
      expect(component['errorMessage']()).toContain(
        'Clé de récupération invalide',
      );
    });

    it('should set generic error message on non-400 error', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 500, statusText: 'Server Error' }),
        ),
      );
      await component['onSubmit']();
      expect(component['errorMessage']()).toContain(
        "Quelque chose n'a pas fonctionné",
      );
    });

    it('should not call setDirectKey on recover$ failure', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }),
        ),
      );
      await component['onSubmit']();
      expect(mockClientKeyService.setDirectKey).not.toHaveBeenCalled();
    });

    it('should reset isSubmitting on error', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }),
        ),
      );
      await component['onSubmit']();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('should not navigate on error', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }),
        ),
      );
      await component['onSubmit']();
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('onSubmit - Incomplete recovery', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should show error when setDirectKey throws after successful recover$', async () => {
      mockClientKeyService.setDirectKey.mockImplementation(() => {
        throw new Error('Invalid client key hex');
      });

      await component['onSubmit']();

      expect(mockEncryptionApi.recover$).toHaveBeenCalled();
      expect(mockEncryptionApi.setupRecoveryKey$).not.toHaveBeenCalled();
      expect(component['errorMessage']()).toContain(
        "Quelque chose n'a pas fonctionné",
      );
    });

    it('should handle setupRecoveryKey$ failure gracefully after successful recovery', async () => {
      mockEncryptionApi.setupRecoveryKey$.mockReturnValue(
        throwError(() => new Error('Recovery key setup failed')),
      );

      await component['onSubmit']();

      expect(mockClientKeyService.setDirectKey).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/', 'dashboard']);
    });
  });
});
