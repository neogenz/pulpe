import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthSessionService } from '@core/auth';
import { Logger } from '@core/logging/logger';

import ForgotPassword from './forgot-password';

describe('ForgotPassword', () => {
  let component: ForgotPassword;
  let mockAuthSession: {
    resetPasswordForEmail: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockAuthSession = {
      resetPasswordForEmail: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: AuthSessionService, useValue: mockAuthSession },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compileComponents();

    component = TestBed.createComponent(ForgotPassword).componentInstance;
  });

  function fillValidForm(): void {
    component['form'].patchValue({
      email: 'test@example.com',
    });
  }

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have form defined', () => {
      expect(component['form']).toBeDefined();
      expect(component['form'].get('email')).toBeDefined();
    });

    it('should have signal properties defined', () => {
      expect(component['isSubmitting']).toBeDefined();
      expect(component['errorMessage']).toBeDefined();
      expect(component['isSuccess']).toBeDefined();
    });

    it('should have computed canSubmit defined', () => {
      expect(component['canSubmit']).toBeDefined();
      expect(typeof component['canSubmit']).toBe('function');
    });
  });

  describe('Default Values', () => {
    it('should have isSubmitting false by default', () => {
      expect(component['isSubmitting']()).toBe(false);
    });

    it('should have errorMessage empty by default', () => {
      expect(component['errorMessage']()).toBe('');
    });

    it('should have isSuccess false by default', () => {
      expect(component['isSuccess']()).toBe(false);
    });
  });

  describe('Form Validation', () => {
    it('should require email', () => {
      const emailControl = component['form'].get('email');
      emailControl?.setValue('');
      expect(emailControl?.hasError('required')).toBe(true);
    });

    it('should validate email format', () => {
      const emailControl = component['form'].get('email');
      emailControl?.setValue('invalid-email');
      expect(emailControl?.hasError('email')).toBe(true);

      emailControl?.setValue('valid@email.com');
      expect(emailControl?.hasError('email')).toBe(false);
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

  describe('clearError', () => {
    it('should reset errorMessage to empty string', () => {
      component['errorMessage'].set('Some error');
      component['clearError']();
      expect(component['errorMessage']()).toBe('');
    });
  });

  describe('onSubmit - Invalid Form', () => {
    it('should not submit when form is invalid', async () => {
      await component['onSubmit']();
      expect(mockAuthSession.resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it('should mark form as touched when invalid', async () => {
      const markAllAsTouchedSpy = vi.spyOn(
        component['form'],
        'markAllAsTouched',
      );

      await component['onSubmit']();

      expect(markAllAsTouchedSpy).toHaveBeenCalled();
    });
  });

  describe('onSubmit - Valid Form', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should set isSubmitting to true when called', async () => {
      mockAuthSession.resetPasswordForEmail.mockResolvedValue({
        success: true,
      });

      const promise = component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);

      await promise;
    });

    it('should clear error message before submitting', async () => {
      component['errorMessage'].set('Previous error');
      mockAuthSession.resetPasswordForEmail.mockResolvedValue({
        success: true,
      });

      await component['onSubmit']();

      expect(component['errorMessage']()).toBe('');
    });

    it('should call resetPasswordForEmail with email', async () => {
      mockAuthSession.resetPasswordForEmail.mockResolvedValue({
        success: true,
      });

      await component['onSubmit']();

      expect(mockAuthSession.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
    });

    it('should set isSuccess to true on successful submission', async () => {
      mockAuthSession.resetPasswordForEmail.mockResolvedValue({
        success: true,
      });

      await component['onSubmit']();

      expect(component['isSuccess']()).toBe(true);
    });

    it('should reset isSubmitting after onSubmit completes (finally block)', async () => {
      mockAuthSession.resetPasswordForEmail.mockResolvedValue({
        success: true,
      });

      await component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('onSubmit - API Failure', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should set error message from API response', async () => {
      mockAuthSession.resetPasswordForEmail.mockResolvedValue({
        success: false,
        error: 'Email not found',
      });

      await component['onSubmit']();

      expect(component['errorMessage']()).toBe('Email not found');
    });

    it('should set default error message when no error in response', async () => {
      mockAuthSession.resetPasswordForEmail.mockResolvedValue({
        success: false,
      });

      await component['onSubmit']();

      expect(component['errorMessage']()).toBe(
        "L'envoi a échoué — réessaie dans quelques instants",
      );
    });

    it('should reset isSubmitting on failure', async () => {
      mockAuthSession.resetPasswordForEmail.mockResolvedValue({
        success: false,
      });

      await component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('onSubmit - Exception', () => {
    beforeEach(() => {
      fillValidForm();
    });

    it('should set generic error message on exception', async () => {
      mockAuthSession.resetPasswordForEmail.mockRejectedValue(
        new Error('Network error'),
      );

      await component['onSubmit']();

      expect(component['errorMessage']()).toBe(
        "Quelque chose n'a pas fonctionné — réessayons",
      );
    });

    it('should log error on exception', async () => {
      const error = new Error('Network error');
      mockAuthSession.resetPasswordForEmail.mockRejectedValue(error);

      await component['onSubmit']();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error sending reset email:',
        error,
      );
    });

    it('should reset isSubmitting on exception', async () => {
      mockAuthSession.resetPasswordForEmail.mockRejectedValue(
        new Error('Network error'),
      );

      await component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
    });
  });
});
