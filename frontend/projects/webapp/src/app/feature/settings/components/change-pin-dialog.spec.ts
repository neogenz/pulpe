import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { EncryptionApi, ClientKeyService } from '@core/encryption';
import { Logger } from '@core/logging/logger';
import { StorageService } from '@core/storage/storage.service';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { ChangePinDialog } from './change-pin-dialog';

vi.mock('@core/encryption/crypto.utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    deriveClientKey: vi
      .fn()
      .mockImplementation((pin: string) =>
        Promise.resolve(pin === '123456' ? 'a'.repeat(64) : 'b'.repeat(64)),
      ),
  };
});

const MOCK_OLD_CLIENT_KEY = 'a'.repeat(64);
const MOCK_NEW_CLIENT_KEY = 'b'.repeat(64);

describe('ChangePinDialog', () => {
  let component: ChangePinDialog;
  let mockDialogRef: { close: Mock };
  let mockEncryptionApi: {
    getSalt$: Mock;
    changePin$: Mock;
    validateKey$: Mock;
  };
  let mockClientKeyService: { setDirectKey: Mock };
  let mockStorage: { getString: Mock };
  let mockLogger: { error: Mock };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockEncryptionApi = {
      getSalt$: vi
        .fn()
        .mockReturnValue(of({ salt: 'abcd1234', kdfIterations: 100000 })),
      changePin$: vi
        .fn()
        .mockReturnValue(
          of({ keyCheck: 'check', recoveryKey: 'recovery-key-123' }),
        ),
      validateKey$: vi.fn().mockReturnValue(of(undefined)),
    };
    mockClientKeyService = { setDirectKey: vi.fn() };
    mockStorage = { getString: vi.fn().mockReturnValue(null) };
    mockLogger = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ChangePinDialog,
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: ClientKeyService, useValue: mockClientKeyService },
        { provide: StorageService, useValue: mockStorage },
        { provide: Logger, useValue: mockLogger },
        ...provideTranslocoForTest(),
      ],
    });

    component = TestBed.inject(ChangePinDialog);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Step 1 - Old PIN', () => {
    it('form invalid when empty', () => {
      expect(component['oldPinForm'].valid).toBe(false);
    });

    it('form invalid when less than 4 digits', () => {
      component['oldPinForm'].patchValue({ oldPin: '123' });
      expect(component['oldPinForm'].valid).toBe(false);
    });

    it('form valid when exactly 4 digits', () => {
      component['oldPinForm'].patchValue({ oldPin: '1234' });
      expect(component['oldPinForm'].valid).toBe(true);
    });

    it('form invalid when non-numeric', () => {
      component['oldPinForm'].patchValue({ oldPin: 'abcdef' });
      expect(component['oldPinForm'].valid).toBe(false);
    });

    it('form valid when exactly 6 digits', () => {
      component['oldPinForm'].patchValue({ oldPin: '123456' });
      expect(component['oldPinForm'].valid).toBe(true);
    });

    it('transitions to step 2 after salt fetch and key validation', async () => {
      component['oldPinForm'].patchValue({ oldPin: '123456' });

      await component['onSubmitOldPin']();

      expect(mockEncryptionApi.validateKey$).toHaveBeenCalled();
      expect(component['step']()).toBe(2);
    });

    it('shows error when salt fetch fails', async () => {
      mockEncryptionApi.getSalt$.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      component['oldPinForm'].patchValue({ oldPin: '123456' });

      await component['onSubmitOldPin']();

      expect(component['errorMessage']()).toBe(
        'Une erreur est survenue — réessaie plus tard',
      );
      expect(component['step']()).toBe(1);
    });

    it('shows error when old PIN is incorrect', async () => {
      mockEncryptionApi.validateKey$.mockReturnValue(
        throwError(
          () =>
            new ApiError(
              'Key check failed',
              'ERR_ENCRYPTION_KEY_CHECK_FAILED',
              400,
              undefined,
            ),
        ),
      );
      component['oldPinForm'].patchValue({ oldPin: '123456' });

      await component['onSubmitOldPin']();

      expect(component['errorMessage']()).toBe('Code PIN incorrect');
      expect(component['step']()).toBe(1);
    });

    it('shows rate limit error on 429', async () => {
      mockEncryptionApi.validateKey$.mockReturnValue(
        throwError(
          () => new ApiError('Too many requests', undefined, 429, undefined),
        ),
      );
      component['oldPinForm'].patchValue({ oldPin: '123456' });

      await component['onSubmitOldPin']();

      expect(component['errorMessage']()).toBe(
        'Trop de tentatives — réessaie plus tard',
      );
      expect(component['step']()).toBe(1);
    });
  });

  describe('Step 2 - New PIN', () => {
    it('form valid when exactly 6 digits', () => {
      component['newPinForm'].patchValue({ newPin: '654321' });
      expect(component['newPinForm'].valid).toBe(true);
    });
  });

  describe('Successful PIN change', () => {
    beforeEach(async () => {
      component['oldPinForm'].patchValue({ oldPin: '123456' });
      await component['onSubmitOldPin']();
    });

    it('calls changePin$ with derived keys', async () => {
      component['newPinForm'].patchValue({ newPin: '654321' });

      await component['onSubmitNewPin']();

      expect(mockEncryptionApi.changePin$).toHaveBeenCalledWith(
        MOCK_OLD_CLIENT_KEY,
        MOCK_NEW_CLIENT_KEY,
      );
    });

    it('calls setDirectKey with new client key', async () => {
      component['newPinForm'].patchValue({ newPin: '654321' });

      await component['onSubmitNewPin']();

      expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
        MOCK_NEW_CLIENT_KEY,
        false,
      );
    });

    it('calls setDirectKey with useLocalStorage true when local key exists', async () => {
      mockStorage.getString.mockReturnValue('some-key');
      component['newPinForm'].patchValue({ newPin: '654321' });

      await component['onSubmitNewPin']();

      expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
        MOCK_NEW_CLIENT_KEY,
        true,
      );
    });

    it('closes dialog with recoveryKey result', async () => {
      component['newPinForm'].patchValue({ newPin: '654321' });

      await component['onSubmitNewPin']();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        recoveryKey: 'recovery-key-123',
      });
    });
  });

  describe('Error handling', () => {
    beforeEach(async () => {
      component['oldPinForm'].patchValue({ oldPin: '123456' });
      await component['onSubmitOldPin']();
    });

    it('shows error and goes back to step 1 on wrong PIN', async () => {
      mockEncryptionApi.changePin$.mockReturnValue(
        throwError(
          () =>
            new ApiError(
              'Key check failed',
              'ERR_ENCRYPTION_KEY_CHECK_FAILED',
              400,
              undefined,
            ),
        ),
      );
      component['newPinForm'].patchValue({ newPin: '654321' });

      await component['onSubmitNewPin']();

      expect(component['errorMessage']()).toBe('Code PIN actuel incorrect');
      expect(component['step']()).toBe(1);
    });

    it('shows error for same PIN', async () => {
      mockEncryptionApi.changePin$.mockReturnValue(
        throwError(
          () =>
            new ApiError('Same key', 'ERR_ENCRYPTION_SAME_KEY', 400, undefined),
        ),
      );
      component['newPinForm'].patchValue({ newPin: '654321' });

      await component['onSubmitNewPin']();

      expect(component['errorMessage']()).toBe(
        "Le nouveau code PIN doit être différent de l'ancien",
      );
    });

    it('shows error for rate limiting', async () => {
      mockEncryptionApi.changePin$.mockReturnValue(
        throwError(
          () => new ApiError('Too many requests', undefined, 429, undefined),
        ),
      );
      component['newPinForm'].patchValue({ newPin: '654321' });

      await component['onSubmitNewPin']();

      expect(component['errorMessage']()).toBe(
        'Trop de tentatives — réessaie plus tard',
      );
    });

    it('shows generic error for unknown failures and resets to step 1', async () => {
      mockEncryptionApi.changePin$.mockReturnValue(
        throwError(() => new Error('Unknown')),
      );
      component['newPinForm'].patchValue({ newPin: '654321' });

      await component['onSubmitNewPin']();

      expect(component['errorMessage']()).toBe(
        'Le changement de code PIN a échoué — réessaie plus tard',
      );
      expect(component['step']()).toBe(1);
    });
  });

  describe('Loading state', () => {
    it('isSubmitting true during submission', async () => {
      let resolvePromise: () => void;
      const blockingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      mockEncryptionApi.getSalt$.mockReturnValue(
        of({ salt: 'abcd1234', kdfIterations: 100000 }),
      );

      // Mock deriveClientKey to block
      const { deriveClientKey } = await import('@core/encryption/crypto.utils');
      (deriveClientKey as Mock).mockImplementationOnce(() =>
        blockingPromise.then(() => MOCK_OLD_CLIENT_KEY),
      );

      component['oldPinForm'].patchValue({ oldPin: '123456' });
      const submitPromise = component['onSubmitOldPin']();

      expect(component['isSubmitting']()).toBe(true);

      resolvePromise!();
      await submitPromise;

      expect(component['isSubmitting']()).toBe(false);
    });
  });
});
