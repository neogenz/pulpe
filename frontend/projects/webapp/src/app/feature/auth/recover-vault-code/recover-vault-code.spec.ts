import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { ClientKeyService, EncryptionApi } from '@core/encryption';
import * as cryptoUtils from '@core/encryption/crypto.utils';
import { ApiError } from '@core/api/api-error';
import { Logger } from '@core/logging/logger';

import RecoverVaultCode from './recover-vault-code';

describe('RecoverVaultCode', () => {
  let fixture: ComponentFixture<RecoverVaultCode>;
  let component: RecoverVaultCode;
  let mockClientKeyService: { setDirectKey: ReturnType<typeof vi.fn> };
  let mockEncryptionApi: {
    getSalt$: ReturnType<typeof vi.fn>;
    recover$: ReturnType<typeof vi.fn>;
    regenerateRecoveryKey$: ReturnType<typeof vi.fn>;
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
      regenerateRecoveryKey$: vi
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

    fixture = TestBed.createComponent(RecoverVaultCode);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  function fillFormViaDom(
    recoveryKey: string,
    newCode: string,
    confirmCode: string,
  ): void {
    const recoveryInput = fixture.nativeElement.querySelector(
      '[data-testid="recovery-key-input"]',
    ) as HTMLInputElement;
    recoveryInput.value = recoveryKey;
    recoveryInput.dispatchEvent(new Event('input'));

    const newCodeInput = fixture.nativeElement.querySelector(
      '[data-testid="new-vault-code-input"]',
    ) as HTMLInputElement;
    newCodeInput.value = newCode;
    newCodeInput.dispatchEvent(new Event('input'));

    const confirmInput = fixture.nativeElement.querySelector(
      '[data-testid="confirm-vault-code-input"]',
    ) as HTMLInputElement;
    confirmInput.value = confirmCode;
    confirmInput.dispatchEvent(new Event('input'));

    fixture.detectChanges();
  }

  async function submitFormViaDom(): Promise<void> {
    const formDE = fixture.debugElement.query(
      (el) =>
        el.nativeElement.getAttribute?.('data-testid') ===
        'recover-vault-code-form',
    );
    formDE.triggerEventHandler('ngSubmit');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should render recovery key, new vault code, and confirm code inputs', () => {
      const recoveryInput = fixture.nativeElement.querySelector(
        '[data-testid="recovery-key-input"]',
      );
      const newCodeInput = fixture.nativeElement.querySelector(
        '[data-testid="new-vault-code-input"]',
      );
      const confirmInput = fixture.nativeElement.querySelector(
        '[data-testid="confirm-vault-code-input"]',
      );
      expect(recoveryInput).toBeTruthy();
      expect(newCodeInput).toBeTruthy();
      expect(confirmInput).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('should not allow submit when recovery key is empty', () => {
      fillFormViaDom('', '123456', '123456');
      expect(component['canSubmit']()).toBe(false);
    });

    it('should not allow submit when new vault code is empty', () => {
      fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '', '');
      expect(component['canSubmit']()).toBe(false);
    });

    it('should not allow submit when new vault code is too short', () => {
      fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '12', '12');
      expect(component['canSubmit']()).toBe(false);
    });

    it('should not allow submit when new vault code is non-numeric', () => {
      fillFormViaDom('ABCD-EFGH-IJKL-MNOP', 'abcd', 'abcd');
      expect(component['canSubmit']()).toBe(false);
    });

    it('should not allow submit when confirm code is empty', () => {
      fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '123456', '');
      expect(component['canSubmit']()).toBe(false);
    });

    it('should not allow submit when codes do not match', () => {
      fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '123456', '654321');
      expect(component['canSubmit']()).toBe(false);
    });

    it('should allow submit when form is valid with matching codes', () => {
      fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '123456', '123456');
      expect(component['canSubmit']()).toBe(true);
    });
  });

  describe('canSubmit', () => {
    it('should be false when form is invalid', () => {
      expect(component['canSubmit']()).toBe(false);
    });

    it('should be true when form is valid', () => {
      fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '123456', '123456');
      expect(component['canSubmit']()).toBe(true);
    });
  });

  describe('onSubmit - Valid Form', () => {
    beforeEach(() => {
      fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '123456', '123456');
    });

    it('should call getSalt$ to get encryption salt', async () => {
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(mockEncryptionApi.getSalt$).toHaveBeenCalled(),
      );
    });

    it('should call deriveClientKey with new vault code and salt', async () => {
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(deriveClientKeySpy).toHaveBeenCalledWith(
          '123456',
          'salt-value',
          100000,
        ),
      );
    });

    it('should call recover$ with recovery key and derived client key', async () => {
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(mockEncryptionApi.recover$).toHaveBeenCalledWith(
          'ABCD-EFGH-IJKL-MNOP',
          'abcd'.repeat(16),
        ),
      );
    });

    it('should call setDirectKey with derived client key', async () => {
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
          'abcd'.repeat(16),
          false,
        ),
      );
    });

    it('should call regenerateRecoveryKey$ after successful recovery', async () => {
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(mockEncryptionApi.regenerateRecoveryKey$).toHaveBeenCalled(),
      );
    });

    it('should open recovery dialog after successful recovery', async () => {
      await submitFormViaDom();
      await vi.waitFor(() => expect(mockDialog.open).toHaveBeenCalled());
    });

    it('should navigate to dashboard after dialog closes', async () => {
      mockDialogRef.afterClosed.mockReturnValue(of(true));
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(navigateSpy).toHaveBeenCalledWith(['/', 'dashboard']),
      );
    });

    it('should reset isSubmitting after onSubmit completes', async () => {
      await submitFormViaDom();
      await vi.waitFor(() => expect(component['isSubmitting']()).toBe(false));
    });
  });

  describe('onSubmit - Error Handling', () => {
    beforeEach(() => {
      fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '123456', '123456');
    });

    it('should show specific error message on 400 response (invalid recovery key)', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }),
        ),
      );
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          'Clé de récupération invalide',
        ),
      );
    });

    it('should show generic error message on non-400 error', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 500, statusText: 'Server Error' }),
        ),
      );
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          "Quelque chose n'a pas fonctionné",
        ),
      );
    });

    it('should not call setDirectKey on recover$ failure', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }),
        ),
      );
      await submitFormViaDom();
      await vi.waitFor(() => expect(component['errorMessage']()).not.toBe(''));
      expect(mockClientKeyService.setDirectKey).not.toHaveBeenCalled();
    });

    it('should not navigate on error', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }),
        ),
      );
      await submitFormViaDom();
      await vi.waitFor(() => expect(component['errorMessage']()).not.toBe(''));
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('onSubmit - ApiError handling', () => {
    beforeEach(() => {
      fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '123456', '123456');
    });

    it('should show specific error when recover$ throws ApiError with status 400', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(() => new ApiError('Bad request', 'ERR_INVALID', 400, null)),
      );
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          'Clé de récupération invalide',
        ),
      );
    });

    it('should show generic error when recover$ throws ApiError with status 500', async () => {
      mockEncryptionApi.recover$.mockReturnValue(
        throwError(() => new ApiError('Server error', undefined, 500, null)),
      );
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          "Quelque chose n'a pas fonctionné",
        ),
      );
    });
  });

  describe('onSubmit - Incomplete recovery', () => {
    beforeEach(() => {
      fillFormViaDom('ABCD-EFGH-IJKL-MNOP', '123456', '123456');
    });

    it('should show error when setDirectKey throws after successful recover$', async () => {
      mockClientKeyService.setDirectKey.mockImplementation(() => {
        throw new Error('Invalid client key hex');
      });

      await submitFormViaDom();

      await vi.waitFor(() => {
        expect(mockEncryptionApi.recover$).toHaveBeenCalled();
        expect(mockEncryptionApi.regenerateRecoveryKey$).not.toHaveBeenCalled();
        expect(component['errorMessage']()).toContain(
          "Quelque chose n'a pas fonctionné",
        );
      });
    });

    it('should handle regenerateRecoveryKey$ failure gracefully after successful recovery', async () => {
      mockEncryptionApi.regenerateRecoveryKey$.mockReturnValue(
        throwError(() => new Error('Recovery key setup failed')),
      );

      await submitFormViaDom();

      await vi.waitFor(() => {
        expect(mockClientKeyService.setDirectKey).toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalled();
        expect(navigateSpy).toHaveBeenCalledWith(['/', 'dashboard']);
      });
    });
  });

  describe('Recovery key auto-formatting', () => {
    it('should auto-format recovery key with dashes on input', () => {
      const recoveryInput = fixture.nativeElement.querySelector(
        '[data-testid="recovery-key-input"]',
      ) as HTMLInputElement;
      recoveryInput.value = 'ABCDEFGHIJKLMNOPQRST';
      recoveryInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const formValue = component['form'].controls.recoveryKey.value;
      expect(formValue).toContain('-');
    });

    it('should preserve formatted value if already formatted', () => {
      const recoveryInput = fixture.nativeElement.querySelector(
        '[data-testid="recovery-key-input"]',
      ) as HTMLInputElement;
      recoveryInput.value = 'ABCD-EFGH-IJKL-MNOP';
      recoveryInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const formValue = component['form'].controls.recoveryKey.value;
      expect(formValue).toBe('ABCD-EFGH-IJKL-MNOP');
    });
  });

  describe('Recovery key case insensitivity', () => {
    it('should accept lowercase recovery key and convert to uppercase', () => {
      const recoveryInput = fixture.nativeElement.querySelector(
        '[data-testid="recovery-key-input"]',
      ) as HTMLInputElement;
      recoveryInput.value = 'abcd-efgh-ijkl-mnop';
      recoveryInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const formValue = component['form'].controls.recoveryKey.value;
      expect(formValue).toBe('ABCD-EFGH-IJKL-MNOP');
    });

    it('should accept mixed case recovery key', () => {
      const recoveryInput = fixture.nativeElement.querySelector(
        '[data-testid="recovery-key-input"]',
      ) as HTMLInputElement;
      recoveryInput.value = 'AbCd-EfGh-IjKl-MnOp';
      recoveryInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const formValue = component['form'].controls.recoveryKey.value;
      expect(formValue).toMatch(/^[A-Z-]+$/);
    });
  });

  describe('Back button navigation', () => {
    it('should have back button with "Retour" text', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const backButton = Array.from(buttons as NodeListOf<Element>).find(
        (btn) => btn.textContent?.includes('Retour'),
      );
      expect(backButton).toBeTruthy();
    });
  });
});
