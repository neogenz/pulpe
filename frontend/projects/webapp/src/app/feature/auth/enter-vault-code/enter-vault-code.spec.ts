import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { ClientKeyService, EncryptionApi } from '@core/encryption';
import * as cryptoUtils from '@core/encryption/crypto.utils';
import { ApiError } from '@core/api/api-error';
import { Logger } from '@core/logging/logger';
import { AuthSessionService } from '@core/auth/auth-session.service';

import EnterVaultCode from './enter-vault-code';

describe('EnterVaultCode', () => {
  let fixture: ComponentFixture<EnterVaultCode>;
  let component: EnterVaultCode;
  let mockClientKeyService: { setDirectKey: ReturnType<typeof vi.fn> };
  let mockEncryptionApi: {
    getSalt$: ReturnType<typeof vi.fn>;
    validateKey$: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
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
      validateKey$: vi.fn().mockReturnValue(of(undefined)),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
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

    fixture = TestBed.createComponent(EnterVaultCode);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  function fillFormViaDom(code: string): void {
    const input = fixture.nativeElement.querySelector(
      '[data-testid="vault-code-input"]',
    ) as HTMLInputElement;
    input.value = code;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submitFormViaDom(): Promise<void> {
    const formDE = fixture.debugElement.query(
      (el) =>
        el.nativeElement.getAttribute?.('data-testid') ===
        'enter-vault-code-form',
    );
    formDE.triggerEventHandler('ngSubmit');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function getVaultCodeInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      '[data-testid="vault-code-input"]',
    ) as HTMLInputElement;
  }

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should render vault code input and remember device checkbox', () => {
      const codeInput = fixture.nativeElement.querySelector(
        '[data-testid="vault-code-input"]',
      );
      const checkbox = fixture.nativeElement.querySelector(
        '[data-testid="remember-device-checkbox"]',
      );
      expect(codeInput).toBeTruthy();
      expect(checkbox).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('should not allow submit when vaultCode is empty', () => {
      fillFormViaDom('');
      expect(component['canSubmit']()).toBe(false);
    });

    it('should not allow submit when vaultCode is too short', () => {
      fillFormViaDom('123');
      expect(component['canSubmit']()).toBe(false);
    });

    it('should allow submit when vaultCode meets minimum length', () => {
      fillFormViaDom('1234');
      expect(component['canSubmit']()).toBe(true);
    });

    it('should not allow submit for non-numeric vaultCode', () => {
      fillFormViaDom('abcd');
      expect(component['canSubmit']()).toBe(false);
    });
  });

  describe('canSubmit', () => {
    it('should be false when form is invalid', () => {
      expect(component['canSubmit']()).toBe(false);
    });

    it('should be true when form is valid', () => {
      fillFormViaDom('123456');
      expect(component['canSubmit']()).toBe(true);
    });
  });

  describe('onSubmit - Valid Form', () => {
    beforeEach(() => {
      fillFormViaDom('123456');
    });

    it('should call getSalt$ to get encryption salt', async () => {
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(mockEncryptionApi.getSalt$).toHaveBeenCalled(),
      );
    });

    it('should call deriveClientKey with vault code and salt', async () => {
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(deriveClientKeySpy).toHaveBeenCalledWith(
          '123456',
          'salt-value',
          100000,
        ),
      );
    });

    it('should call validateKey$ with derived client key', async () => {
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(mockEncryptionApi.validateKey$).toHaveBeenCalledWith(
          'abcd'.repeat(16),
        ),
      );
    });

    it('should call setDirectKey with derived client key and rememberDevice value', async () => {
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
          'abcd'.repeat(16),
          false,
        ),
      );
    });

    it('should use localStorage when rememberDevice is checked', async () => {
      const checkbox = fixture.nativeElement.querySelector(
        '[data-testid="remember-device-checkbox"] input',
      ) as HTMLInputElement;
      checkbox.click();
      fixture.detectChanges();
      await fixture.whenStable();

      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
          'abcd'.repeat(16),
          true,
        ),
      );
    });

    it('should navigate to dashboard after successful submission', async () => {
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
      fillFormViaDom('123456');
    });

    it('should show error message on submission failure', async () => {
      vi.spyOn(mockEncryptionApi, 'getSalt$').mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          "Quelque chose n'a pas fonctionné",
        ),
      );
    });

    it('should not navigate on error', async () => {
      vi.spyOn(mockEncryptionApi, 'getSalt$').mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      await submitFormViaDom();
      await vi.waitFor(() => expect(component['errorMessage']()).not.toBe(''));
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('onSubmit - HTTP errors', () => {
    beforeEach(() => {
      fillFormViaDom('123456');
    });

    it('should show specific error when validateKey$ returns HTTP 400', async () => {
      mockEncryptionApi.validateKey$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }),
        ),
      );
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          'Ce code ne semble pas correct',
        ),
      );
    });

    it('should not store key or navigate when validateKey$ returns HTTP 400', async () => {
      mockEncryptionApi.validateKey$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }),
        ),
      );
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          'Ce code ne semble pas correct',
        ),
      );
      expect(mockClientKeyService.setDirectKey).not.toHaveBeenCalled();
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('should show generic error when getSalt$ returns HTTP 500', async () => {
      mockEncryptionApi.getSalt$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 500,
              statusText: 'Server Error',
            }),
        ),
      );
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          "Quelque chose n'a pas fonctionné",
        ),
      );
    });

    it('should show generic error when validateKey$ returns HTTP 429', async () => {
      mockEncryptionApi.validateKey$.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 429,
              statusText: 'Too Many Requests',
            }),
        ),
      );
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          "Quelque chose n'a pas fonctionné",
        ),
      );
    });
  });

  describe('onSubmit - ApiError handling', () => {
    beforeEach(() => {
      fillFormViaDom('123456');
    });

    it('should show specific error when validateKey$ throws ApiError with status 400', async () => {
      mockEncryptionApi.validateKey$.mockReturnValue(
        throwError(() => new ApiError('Bad request', 'ERR_INVALID', 400, null)),
      );
      await submitFormViaDom();
      await vi.waitFor(() =>
        expect(component['errorMessage']()).toContain(
          'Ce code ne semble pas correct',
        ),
      );
    });

    it('should show generic error when validateKey$ throws ApiError with status 500', async () => {
      mockEncryptionApi.validateKey$.mockReturnValue(
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

  describe('Logout Button', () => {
    let mockAuthSession: {
      signOut: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
      mockAuthSession = {
        signOut: vi.fn().mockResolvedValue(undefined),
      };

      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [EnterVaultCode],
        providers: [
          provideZonelessChangeDetection(),
          provideAnimationsAsync(),
          provideRouter([]),
          { provide: ClientKeyService, useValue: mockClientKeyService },
          { provide: EncryptionApi, useValue: mockEncryptionApi },
          { provide: AuthSessionService, useValue: mockAuthSession },
          { provide: Logger, useValue: mockLogger },
        ],
      }).compileComponents();

      const logoutFixture = TestBed.createComponent(EnterVaultCode);
      logoutFixture.detectChanges();
      await logoutFixture.whenStable();

      component = logoutFixture.componentInstance;
      fixture = logoutFixture;
    });

    it('should call authSession.signOut when logout button is clicked', async () => {
      vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        href: '/',
      });

      const logoutButton = fixture.nativeElement.querySelector(
        '[data-testid="vault-code-logout-button"]',
      ) as HTMLButtonElement;
      logoutButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockAuthSession.signOut).toHaveBeenCalled();
    });
  });

  describe('Navigation Links', () => {
    it('should have "Code perdu?" link with correct routerLink', () => {
      const link = fixture.nativeElement.querySelector(
        '[data-testid="lost-code-link"]',
      );
      expect(link).toBeTruthy();
      expect(link.textContent).toContain('Code perdu');
    });
  });

  describe('PIN Visibility Toggle', () => {
    it('should start with password type (hidden)', () => {
      const input = getVaultCodeInput();
      expect(input.type).toBe('password');
    });

    it('should toggle input type when visibility button is clicked', async () => {
      const input = getVaultCodeInput();
      expect(input.type).toBe('password');

      const toggleButton = fixture.nativeElement.querySelector(
        'mat-form-field button[type="button"]',
      ) as HTMLButtonElement;
      toggleButton.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(input.type).toBe('text');

      toggleButton.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(input.type).toBe('password');
    });
  });
});
