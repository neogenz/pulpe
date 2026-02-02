import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { ClientKeyService, EncryptionApi } from '@core/encryption';
import * as cryptoUtils from '@core/encryption/crypto.utils';
import { Logger } from '@core/logging/logger';

import EnterVaultCode from './enter-vault-code';

describe('EnterVaultCode', () => {
  let component: EnterVaultCode;
  let mockClientKeyService: { setDirectKey: ReturnType<typeof vi.fn> };
  let mockEncryptionApi: {
    getSalt$: ReturnType<typeof vi.fn>;
  };
  let mockLogger: { error: ReturnType<typeof vi.fn> };
  let navigateSpy: ReturnType<typeof vi.fn>;
  let deriveClientKeySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    deriveClientKeySpy = vi
      .spyOn(cryptoUtils, 'deriveClientKey')
      .mockResolvedValue('abcd'.repeat(16));

    mockClientKeyService = {
      setDirectKey: vi.fn(),
    };

    mockEncryptionApi = {
      getSalt$: vi
        .fn()
        .mockReturnValue(of({ salt: 'salt-value', kdfIterations: 100000 })),
    };

    mockLogger = {
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [EnterVaultCode],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: ClientKeyService, useValue: mockClientKeyService },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compileComponents();

    component = TestBed.createComponent(EnterVaultCode).componentInstance;

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  function fillValidForm(): void {
    component['form'].patchValue({
      vaultCode: 'myvaultcode123',
      rememberDevice: false,
    });
  }

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have form defined with vaultCode and rememberDevice', () => {
      expect(component['form']).toBeDefined();
      expect(component['form'].get('vaultCode')).toBeDefined();
      expect(component['form'].get('rememberDevice')).toBeDefined();
    });
  });

  describe('Form Validation', () => {
    it('should require vaultCode', () => {
      const control = component['form'].get('vaultCode');
      control?.setValue('');
      expect(control?.hasError('required')).toBe(true);
    });

    it('should validate vaultCode minimum length of 8', () => {
      const control = component['form'].get('vaultCode');
      control?.setValue('short');
      expect(control?.hasError('minlength')).toBe(true);

      control?.setValue('validcode123');
      expect(control?.hasError('minlength')).toBe(false);
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
        'myvaultcode123',
        'salt-value',
        100000,
      );
    });

    it('should call setDirectKey with derived client key and localStorage', async () => {
      await component['onSubmit']();
      expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
        'abcd'.repeat(16),
        true,
      );
    });

    it('should always use localStorage regardless of rememberDevice', async () => {
      component['form'].patchValue({ rememberDevice: false });
      await component['onSubmit']();
      expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
        'abcd'.repeat(16),
        true,
      );
    });

    it('should navigate to dashboard after successful submission', async () => {
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
      component['form'].patchValue({ vaultCode: '' });
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

    it('should not navigate on error', async () => {
      vi.spyOn(mockEncryptionApi, 'getSalt$').mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      await component['onSubmit']();
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
