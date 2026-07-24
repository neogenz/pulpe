import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OAuthProviderButton } from './oauth-provider-button';
import { AuthOAuthService } from '@core/auth';
import { Logger } from '@core/logging/logger';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

describe('OAuthProviderButton', () => {
  let component: OAuthProviderButton;
  let mockAuthOAuth: { signInWithOAuth: ReturnType<typeof vi.fn> };
  let mockLogger: { error: ReturnType<typeof vi.fn> };

  function createComponent(): OAuthProviderButton {
    const fixture = TestBed.createComponent(OAuthProviderButton);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(async () => {
    mockAuthOAuth = {
      signInWithOAuth: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [OAuthProviderButton],
      providers: [
        ...provideTranslocoForTest(),
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        { provide: AuthOAuthService, useValue: mockAuthOAuth },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compileComponents();

    component = createComponent();
  });

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have output properties defined', () => {
      expect(component.loadingChange).toBeDefined();
      expect(component.authError).toBeDefined();
    });

    it('should have isLoading false by default', () => {
      expect(component.isLoading()).toBe(false);
    });

    it('should have default buttonType as outlined', () => {
      expect(component.buttonType()).toBe('outlined');
    });
  });

  // The vitest JIT env cannot bind signal inputs (registered only in AOT),
  // so provider-derived behavior is asserted on the default; the apple
  // variant is covered by the AOT build + Playwright visual verification.
  describe('Provider-derived defaults', () => {
    it('should derive the testId from the provider when not overridden', () => {
      expect(component['resolvedTestId']()).toBe('google-oauth-button');
    });

    it('should derive the label key from the provider', () => {
      expect(component['labelKey']()).toBe('auth.continueWithGoogle');
    });
  });

  describe('signIn - Success Path', () => {
    it('should call the OAuth service with its provider', async () => {
      mockAuthOAuth.signInWithOAuth.mockResolvedValue({ success: true });

      await component.signIn();

      expect(mockAuthOAuth.signInWithOAuth).toHaveBeenCalledWith('google');
    });

    it('should set isLoading to true when called', async () => {
      mockAuthOAuth.signInWithOAuth.mockResolvedValue({ success: true });

      const promise = component.signIn();
      expect(component.isLoading()).toBe(true);

      await promise;
    });

    it('should emit loading true when called', async () => {
      mockAuthOAuth.signInWithOAuth.mockResolvedValue({ success: true });
      const loadingEmitSpy = vi.fn();
      component.loadingChange.subscribe(loadingEmitSpy);

      await component.signIn();

      expect(loadingEmitSpy).toHaveBeenCalledWith(true);
    });

    it('should not emit error on success', async () => {
      mockAuthOAuth.signInWithOAuth.mockResolvedValue({ success: true });
      const errorEmitSpy = vi.fn();
      component.authError.subscribe(errorEmitSpy);

      await component.signIn();

      expect(errorEmitSpy).not.toHaveBeenCalled();
    });

    it('should reset isLoading after signIn completes (finally block)', async () => {
      mockAuthOAuth.signInWithOAuth.mockResolvedValue({ success: true });

      await component.signIn();

      expect(component.isLoading()).toBe(false);
    });
  });

  describe('signIn - Failure Path', () => {
    it('should emit error when API returns failure', async () => {
      mockAuthOAuth.signInWithOAuth.mockResolvedValue({
        success: false,
        error: 'Compte non autorisé',
      });
      const errorEmitSpy = vi.fn();
      component.authError.subscribe(errorEmitSpy);

      await component.signIn();

      expect(errorEmitSpy).toHaveBeenCalledWith('Compte non autorisé');
    });

    it('should emit default error when no error message provided', async () => {
      mockAuthOAuth.signInWithOAuth.mockResolvedValue({ success: false });
      const errorEmitSpy = vi.fn();
      component.authError.subscribe(errorEmitSpy);

      await component.signIn();

      expect(errorEmitSpy).toHaveBeenCalledWith(
        'La connexion a échoué — réessaie',
      );
    });

    it('should reset isLoading on failure', async () => {
      mockAuthOAuth.signInWithOAuth.mockResolvedValue({ success: false });

      await component.signIn();

      expect(component.isLoading()).toBe(false);
    });

    it('should emit loading false on failure', async () => {
      mockAuthOAuth.signInWithOAuth.mockResolvedValue({ success: false });
      const loadingEmitSpy = vi.fn();
      component.loadingChange.subscribe(loadingEmitSpy);

      await component.signIn();

      expect(loadingEmitSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('signIn - Exception Path', () => {
    it('should emit error when exception is thrown', async () => {
      mockAuthOAuth.signInWithOAuth.mockRejectedValue(
        new Error('Network error'),
      );
      const errorEmitSpy = vi.fn();
      component.authError.subscribe(errorEmitSpy);

      await component.signIn();

      expect(errorEmitSpy).toHaveBeenCalledWith(
        'La connexion a échoué — réessaie',
      );
    });

    it('should log error when exception is thrown', async () => {
      const error = new Error('Network error');
      mockAuthOAuth.signInWithOAuth.mockRejectedValue(error);

      await component.signIn();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'google OAuth error',
        error,
      );
    });

    it('should reset isLoading on exception', async () => {
      mockAuthOAuth.signInWithOAuth.mockRejectedValue(
        new Error('Network error'),
      );

      await component.signIn();

      expect(component.isLoading()).toBe(false);
    });

    it('should emit loading false on exception', async () => {
      mockAuthOAuth.signInWithOAuth.mockRejectedValue(
        new Error('Network error'),
      );
      const loadingEmitSpy = vi.fn();
      component.loadingChange.subscribe(loadingEmitSpy);

      await component.signIn();

      expect(loadingEmitSpy).toHaveBeenCalledWith(false);
    });

    // Pas de test unitaire sur `disabled` : cet env vitest JIT n'applique pas
    // les bindings d'input après la première instanciation du type (cf. le
    // commentaire sur `provider` dans le composant) — ni `setInput` ni
    // `inputBinding` n'atteignent le signal. Le binding `[disabled]` des
    // parents est type-checké par le build AOT.
  });
});
