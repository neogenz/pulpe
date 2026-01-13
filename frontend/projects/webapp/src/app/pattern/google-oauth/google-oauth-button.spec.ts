import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleOAuthButton } from './google-oauth-button';
import { AuthApi } from '@core/auth/auth-api';
import { Logger } from '@core/logging/logger';

describe('GoogleOAuthButton', () => {
  let component: GoogleOAuthButton;
  let mockAuthApi: { signInWithGoogle: ReturnType<typeof vi.fn> };
  let mockLogger: { error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthApi = {
      signInWithGoogle: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [GoogleOAuthButton],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        { provide: AuthApi, useValue: mockAuthApi },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compileComponents();

    component = TestBed.createComponent(GoogleOAuthButton).componentInstance;
  });

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have input properties defined', () => {
      expect(component.buttonLabel).toBeDefined();
      expect(component.buttonType).toBeDefined();
      expect(component.testId).toBeDefined();
    });

    it('should have output properties defined', () => {
      expect(component.loadingChange).toBeDefined();
      expect(component.authError).toBeDefined();
    });

    it('should have isLoading signal defined', () => {
      expect(component.isLoading).toBeDefined();
      expect(typeof component.isLoading).toBe('function');
    });
  });

  describe('Default Values', () => {
    it('should have default buttonLabel', () => {
      expect(component.buttonLabel()).toBe('Continuer avec Google');
    });

    it('should have default buttonType as outlined', () => {
      expect(component.buttonType()).toBe('outlined');
    });

    it('should have default testId', () => {
      expect(component.testId()).toBe('google-oauth-button');
    });

    it('should have isLoading false by default', () => {
      expect(component.isLoading()).toBe(false);
    });
  });

  describe('signInWithGoogle - Success Path', () => {
    it('should set isLoading to true when called', async () => {
      mockAuthApi.signInWithGoogle.mockResolvedValue({ success: true });

      const promise = component.signInWithGoogle();
      expect(component.isLoading()).toBe(true);

      await promise;
    });

    it('should emit loading true when called', async () => {
      mockAuthApi.signInWithGoogle.mockResolvedValue({ success: true });
      const loadingEmitSpy = vi.fn();
      component.loadingChange.subscribe(loadingEmitSpy);

      await component.signInWithGoogle();

      expect(loadingEmitSpy).toHaveBeenCalledWith(true);
    });

    it('should not emit error on success', async () => {
      mockAuthApi.signInWithGoogle.mockResolvedValue({ success: true });
      const errorEmitSpy = vi.fn();
      component.authError.subscribe(errorEmitSpy);

      await component.signInWithGoogle();

      expect(errorEmitSpy).not.toHaveBeenCalled();
    });

    it('should reset isLoading after signInWithGoogle completes (finally block)', async () => {
      mockAuthApi.signInWithGoogle.mockResolvedValue({ success: true });

      await component.signInWithGoogle();

      expect(component.isLoading()).toBe(false);
    });
  });

  describe('signInWithGoogle - Failure Path', () => {
    it('should emit error when API returns failure', async () => {
      mockAuthApi.signInWithGoogle.mockResolvedValue({
        success: false,
        error: 'Compte non autorisé',
      });
      const errorEmitSpy = vi.fn();
      component.authError.subscribe(errorEmitSpy);

      await component.signInWithGoogle();

      expect(errorEmitSpy).toHaveBeenCalledWith('Compte non autorisé');
    });

    it('should emit default error when no error message provided', async () => {
      mockAuthApi.signInWithGoogle.mockResolvedValue({ success: false });
      const errorEmitSpy = vi.fn();
      component.authError.subscribe(errorEmitSpy);

      await component.signInWithGoogle();

      expect(errorEmitSpy).toHaveBeenCalledWith(
        'Erreur lors de la connexion avec Google',
      );
    });

    it('should reset isLoading on failure', async () => {
      mockAuthApi.signInWithGoogle.mockResolvedValue({ success: false });

      await component.signInWithGoogle();

      expect(component.isLoading()).toBe(false);
    });

    it('should emit loading false on failure', async () => {
      mockAuthApi.signInWithGoogle.mockResolvedValue({ success: false });
      const loadingEmitSpy = vi.fn();
      component.loadingChange.subscribe(loadingEmitSpy);

      await component.signInWithGoogle();

      expect(loadingEmitSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('signInWithGoogle - Exception Path', () => {
    it('should emit error when exception is thrown', async () => {
      mockAuthApi.signInWithGoogle.mockRejectedValue(
        new Error('Network error'),
      );
      const errorEmitSpy = vi.fn();
      component.authError.subscribe(errorEmitSpy);

      await component.signInWithGoogle();

      expect(errorEmitSpy).toHaveBeenCalledWith(
        'Erreur lors de la connexion avec Google',
      );
    });

    it('should log error when exception is thrown', async () => {
      const error = new Error('Network error');
      mockAuthApi.signInWithGoogle.mockRejectedValue(error);

      await component.signInWithGoogle();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Google OAuth error',
        error,
      );
    });

    it('should reset isLoading on exception', async () => {
      mockAuthApi.signInWithGoogle.mockRejectedValue(
        new Error('Network error'),
      );

      await component.signInWithGoogle();

      expect(component.isLoading()).toBe(false);
    });

    it('should emit loading false on exception', async () => {
      mockAuthApi.signInWithGoogle.mockRejectedValue(
        new Error('Network error'),
      );
      const loadingEmitSpy = vi.fn();
      component.loadingChange.subscribe(loadingEmitSpy);

      await component.signInWithGoogle();

      expect(loadingEmitSpy).toHaveBeenCalledWith(false);
    });
  });
});
