import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { RegenerateRecoveryKeyDialog } from './regenerate-recovery-key-dialog';
import { Logger } from '@core/logging/logger';
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

describe('RegenerateRecoveryKeyDialog', () => {
  let component: RegenerateRecoveryKeyDialog;
  let mockDialogRef: { close: Mock };
  let mockEncryptionApi: {
    getSalt$: Mock;
    validateKey$: Mock;
  };
  let mockLogger: { debug: Mock; info: Mock; warn: Mock; error: Mock };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
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
        RegenerateRecoveryKeyDialog,
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    component = TestBed.inject(RegenerateRecoveryKeyDialog);
  });

  it('should have invalid form when empty', () => {
    expect(component['verificationForm'].valid).toBe(false);
  });

  it('should expose vaultCode field for verification', () => {
    expect(component['verificationForm'].get('vaultCode')).toBeTruthy();
    expect(component['verificationForm'].get('password')).toBeNull();
  });

  it('should have valid form when all fields filled', () => {
    component['verificationForm'].patchValue({
      vaultCode: '123456',
    });
    expect(component['verificationForm'].valid).toBe(true);
  });

  it('should reject non-numeric vaultCode', () => {
    component['verificationForm'].patchValue({
      vaultCode: 'abcd',
    });
    expect(component['verificationForm'].valid).toBe(false);
    expect(
      component['verificationForm'].get('vaultCode')?.hasError('pattern'),
    ).toBe(true);
  });

  it('should show error when password verification fails', async () => {
    mockEncryptionApi.getSalt$.mockReturnValue(
      of({ salt: 'test-salt', kdfIterations: 100000 }),
    );
    deriveClientKeyMock.mockResolvedValue('test-client-key-hex');
    mockEncryptionApi.validateKey$.mockReturnValue(
      throwError(() => new Error('Invalid key')),
    );

    component['verificationForm'].patchValue({
      vaultCode: '999999',
    });

    await component['onSubmit']();

    expect(component['errorMessage']()).toBe(
      'Code PIN incorrect ou clé de chiffrement invalide',
    );
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should close dialog on successful verification', async () => {
    mockEncryptionApi.getSalt$.mockReturnValue(
      of({ salt: 'test-salt', kdfIterations: 100000 }),
    );
    deriveClientKeyMock.mockResolvedValue('test-client-key-hex');
    mockEncryptionApi.validateKey$.mockReturnValue(of(undefined));

    component['verificationForm'].patchValue({
      vaultCode: '123456',
    });

    await component['onSubmit']();

    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should not submit when already submitting', async () => {
    component['isSubmitting'].set(true);

    component['verificationForm'].patchValue({
      vaultCode: '123456',
    });

    await component['onSubmit']();

    expect(mockEncryptionApi.getSalt$).not.toHaveBeenCalled();
  });
});
