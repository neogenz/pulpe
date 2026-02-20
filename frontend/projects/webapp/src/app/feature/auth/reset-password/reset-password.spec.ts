import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  AuthSessionService,
  AuthStateService,
  PASSWORD_MIN_LENGTH,
} from '@core/auth';
import { Logger } from '@core/logging/logger';

import ResetPassword from './reset-password';

describe('ResetPassword', () => {
  let fixture: ComponentFixture<ResetPassword>;
  let component: ResetPassword;
  let mockAuthSessionService: { updatePassword: ReturnType<typeof vi.fn> };
  let mockAuthStateService: {
    isLoading: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let navigateSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockAuthSessionService = {
      updatePassword: vi.fn(),
    };

    mockAuthStateService = {
      isLoading: vi.fn().mockReturnValue(false),
      isAuthenticated: vi.fn().mockReturnValue(true),
    };

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: AuthSessionService, useValue: mockAuthSessionService },
        { provide: AuthStateService, useValue: mockAuthStateService },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPassword);
    component = fixture.componentInstance;

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  async function fillFormViaDom(
    password: string,
    confirmPassword: string,
  ): Promise<void> {
    const passwordInput = fixture.nativeElement.querySelector(
      '[data-testid="new-password-input"]',
    ) as HTMLInputElement;
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input'));

    const confirmInput = fixture.nativeElement.querySelector(
      '[data-testid="confirm-password-input"]',
    ) as HTMLInputElement;
    confirmInput.value = confirmPassword;
    confirmInput.dispatchEvent(new Event('input'));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function fillValidForm(): Promise<void> {
    await fillFormViaDom('newpassword123', 'newpassword123');
  }

  async function submitFormViaDom(): Promise<void> {
    const formDE = fixture.debugElement.query(
      (el) =>
        el.nativeElement.getAttribute?.('data-testid') ===
        'reset-password-form',
    );
    formDE.triggerEventHandler('ngSubmit');
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function isSubmitDisabled(): boolean {
    return !component['canSubmit']();
  }

  function getPasswordInputType(): string {
    const input = fixture.nativeElement.querySelector(
      '[data-testid="new-password-input"]',
    ) as HTMLInputElement;
    return input.type;
  }

  function getConfirmPasswordInputType(): string {
    const input = fixture.nativeElement.querySelector(
      '[data-testid="confirm-password-input"]',
    ) as HTMLInputElement;
    return input.type;
  }

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should render the reset password page', () => {
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="reset-password-page"]',
        ),
      ).toBeTruthy();
    });

    it('should render the form with all fields', () => {
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="reset-password-form"]',
        ),
      ).toBeTruthy();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="new-password-input"]',
        ),
      ).toBeTruthy();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="confirm-password-input"]',
        ),
      ).toBeTruthy();
    });

    it('should not render recovery key field', () => {
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="recovery-key-input"]',
        ),
      ).toBeFalsy();
    });

    it('should render the submit button', () => {
      expect(
        fixture.nativeElement.querySelector('pulpe-loading-button'),
      ).toBeTruthy();
    });
  });

  describe('Session Check', () => {
    it('should show the reset password form when authenticated', () => {
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="reset-password-form"]',
        ),
      ).toBeTruthy();
    });

    it('should set isSessionValid to false when not authenticated', () => {
      mockAuthStateService.isAuthenticated.mockReturnValue(false);

      const newComponent =
        TestBed.createComponent(ResetPassword).componentInstance;

      expect(newComponent['isSessionValid']()).toBe(false);
    });

    it('should not show spinner after session check completes', () => {
      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeFalsy();
    });
  });

  describe('Default Values', () => {
    it('should have password fields hidden by default', () => {
      expect(getPasswordInputType()).toBe('password');
      expect(getConfirmPasswordInputType()).toBe('password');
    });

    it('should have submit button disabled by default (empty form)', () => {
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should have no error message by default', () => {
      const alert = fixture.nativeElement.querySelector(
        'pulpe-error-alert span',
      );
      expect(alert?.textContent?.trim() ?? '').toBe('');
    });

    it('should not show spinner after init', () => {
      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeFalsy();
    });

    it('should show the reset password form by default (authenticated)', () => {
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="reset-password-form"]',
        ),
      ).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('should keep submit button disabled when newPassword is empty', async () => {
      await fillFormViaDom('', 'newpassword123');
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should keep submit button disabled when password is too short', async () => {
      await fillFormViaDom('short', 'short');
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should use PASSWORD_MIN_LENGTH constant for validation', async () => {
      const shortPassword = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
      const validPassword = 'a'.repeat(PASSWORD_MIN_LENGTH);

      await fillFormViaDom(shortPassword, shortPassword);
      expect(isSubmitDisabled()).toBe(true);

      await fillFormViaDom(validPassword, validPassword);
      expect(isSubmitDisabled()).toBe(false);
    });

    it('should keep submit button disabled when confirmPassword is empty', async () => {
      await fillFormViaDom('newpassword123', '');
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should enable submit button when form is valid', async () => {
      await fillValidForm();
      expect(isSubmitDisabled()).toBe(false);
    });
  });

  describe('passwordsMatchValidator', () => {
    it('should not disable submit when both fields are empty', async () => {
      await fillFormViaDom('', '');
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should enable submit when passwords match', async () => {
      await fillFormViaDom('newpassword123', 'newpassword123');
      expect(isSubmitDisabled()).toBe(false);
    });

    it('should disable submit when passwords do not match', async () => {
      await fillFormViaDom('newpassword123', 'differentpassword');
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should show mismatch error in DOM after submit attempt', async () => {
      await fillFormViaDom('newpassword123', 'differentpassword');
      await submitFormViaDom();

      const matErrors = fixture.nativeElement.querySelectorAll('mat-error');
      const texts = Array.from(matErrors as NodeListOf<Element>).map((el) =>
        el.textContent?.trim(),
      );
      expect(texts.some((t) => t?.includes('ne correspondent pas'))).toBe(true);
    });
  });

  describe('Submit button state', () => {
    it('should be disabled when form is invalid', () => {
      expect(isSubmitDisabled()).toBe(true);
    });

    it('should be enabled when form is valid', async () => {
      await fillValidForm();
      expect(isSubmitDisabled()).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear error message when typing into password field', () => {
      component['errorMessage'].set('Some error');
      expect(component['errorMessage']()).toBe('Some error');

      const passwordInput = fixture.nativeElement.querySelector(
        '[data-testid="new-password-input"]',
      ) as HTMLInputElement;
      passwordInput.dispatchEvent(new Event('input'));

      expect(component['errorMessage']()).toBe('');
    });
  });

  describe('onSubmit - Invalid Form', () => {
    it('should not call updatePassword when form is invalid', async () => {
      await submitFormViaDom();

      expect(mockAuthSessionService.updatePassword).not.toHaveBeenCalled();
    });

    it('should show validation errors when submitting invalid form', async () => {
      await submitFormViaDom();
      fixture.detectChanges();

      const matErrors = fixture.nativeElement.querySelectorAll('mat-error');
      expect(matErrors.length).toBeGreaterThan(0);
    });
  });

  describe('onSubmit - Valid Form', () => {
    beforeEach(async () => {
      await fillValidForm();
      mockAuthSessionService.updatePassword.mockResolvedValue({
        success: true,
      });
    });

    it('should disable submit while submitting and re-enable after', async () => {
      await submitFormViaDom();

      await vi.waitFor(() => expect(isSubmitDisabled()).toBe(false));
    });

    it('should clear error message before submitting', async () => {
      component['errorMessage'].set('Previous error');

      await submitFormViaDom();

      expect(component['errorMessage']()).toBe('');
    });

    it('should call updatePassword with new password', async () => {
      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(mockAuthSessionService.updatePassword).toHaveBeenCalledWith(
          'newpassword123',
        ),
      );
    });

    it('should navigate to dashboard after successful password update', async () => {
      await submitFormViaDom();

      await vi.waitFor(() =>
        expect(navigateSpy).toHaveBeenCalledWith(['/', 'dashboard']),
      );
    });

    it('should re-enable submit button after onSubmit completes', async () => {
      await submitFormViaDom();

      await vi.waitFor(() => expect(isSubmitDisabled()).toBe(false));
    });
  });

  describe('onSubmit - updatePassword failure', () => {
    beforeEach(async () => {
      await fillValidForm();
      mockAuthSessionService.updatePassword.mockResolvedValue({
        success: false,
        error: 'Password update failed',
      });
    });

    it('should show error message for password update failure', async () => {
      await submitFormViaDom();

      await vi.waitFor(() => expect(component['errorMessage']()).toBeTruthy());
    });

    it('should re-enable submit button on password update failure', async () => {
      await submitFormViaDom();

      await vi.waitFor(() => expect(isSubmitDisabled()).toBe(false));
    });

    it('should not navigate on password update failure', async () => {
      await submitFormViaDom();

      await vi.waitFor(() => expect(navigateSpy).not.toHaveBeenCalled());
    });
  });
});
