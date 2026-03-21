import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { ApiError } from '@core/api/api-error';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { EncryptionApi } from '@core/encryption';
import { Logger } from '@core/logging/logger';
import { API_ERROR_CODES } from 'pulpe-shared';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { VerifyRecoveryKeyDialog } from './verify-recovery-key-dialog';

describe('VerifyRecoveryKeyDialog', () => {
  let component: VerifyRecoveryKeyDialog;
  let mockDialogRef: { close: Mock };
  let mockEncryptionApi: { verifyRecoveryKey$: Mock };
  let mockSnackBar: { open: Mock };
  let mockLogger: { error: Mock };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockEncryptionApi = {
      verifyRecoveryKey$: vi.fn(),
    };
    mockSnackBar = {
      open: vi.fn(),
    };
    mockLogger = {
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ...provideTranslocoForTest(),
        VerifyRecoveryKeyDialog,
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: Logger, useValue: mockLogger },
        ApiErrorLocalizer,
      ],
    });

    component = TestBed.inject(VerifyRecoveryKeyDialog);
  });

  it('should have invalid form when empty', () => {
    expect(component['verifyRecoveryForm'].valid).toBe(false);
  });

  it('should close dialog and show snackbar on success', async () => {
    mockEncryptionApi.verifyRecoveryKey$.mockReturnValue(of(undefined));
    component['verifyRecoveryForm'].patchValue({
      recoveryKey: 'AAAA-BBBB-CCCC-DDDD',
    });

    await component['verifyRecoveryKey']();

    expect(mockSnackBar.open).toHaveBeenCalled();
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should set error message when key is invalid', async () => {
    const apiError = new ApiError(
      'invalid',
      API_ERROR_CODES.RECOVERY_KEY_INVALID,
      400,
      undefined,
    );
    mockEncryptionApi.verifyRecoveryKey$.mockReturnValue(
      throwError(() => apiError),
    );
    component['verifyRecoveryForm'].patchValue({
      recoveryKey: 'AAAA-BBBB-CCCC-DDDD',
    });

    await component['verifyRecoveryKey']();

    expect(component['errorMessage']()).toBeTruthy();
    expect(mockDialogRef.close).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
