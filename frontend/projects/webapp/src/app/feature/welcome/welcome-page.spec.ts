import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import WelcomePage from './welcome-page';
import { AuthApi } from '@core/auth/auth-api';
import { DemoInitializerService } from '@core/demo/demo-initializer.service';
import { Logger } from '@core/logging/logger';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { signal } from '@angular/core';

describe('WelcomePage', () => {
  let fixture: ComponentFixture<WelcomePage>;
  let component: WelcomePage;
  let mockAuthApi: { signInWithGoogle: Mock };
  let mockDemoInitializer: {
    startDemoSession: Mock;
    isInitializing: ReturnType<typeof signal<boolean>>;
  };
  let mockLogger: {
    debug: Mock;
    info: Mock;
    warn: Mock;
    error: Mock;
  };
  let mockConfig: {
    turnstile: Mock;
    isLocal: Mock;
  };

  beforeEach(async () => {
    mockAuthApi = {
      signInWithGoogle: vi.fn(),
    };

    mockDemoInitializer = {
      startDemoSession: vi.fn(),
      isInitializing: signal(false),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockConfig = {
      turnstile: vi.fn().mockReturnValue({ siteKey: 'test-site-key' }),
      isLocal: vi.fn().mockReturnValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [WelcomePage, NoopAnimationsModule, RouterModule.forRoot([])],
      providers: [
        { provide: AuthApi, useValue: mockAuthApi },
        { provide: DemoInitializerService, useValue: mockDemoInitializer },
        { provide: Logger, useValue: mockLogger },
        { provide: ApplicationConfiguration, useValue: mockConfig },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('template', () => {
    it('should display welcome title', () => {
      const title = fixture.nativeElement.querySelector('h1');

      expect(title.textContent).toContain('Bienvenue dans Pulpe');
    });

    it('should display value proposition', () => {
      const subtitle = fixture.nativeElement.querySelector('p.text-body-large');

      expect(subtitle.textContent).toContain(
        'Reprends le contrôle de tes finances',
      );
    });

    it('should have Google OAuth button', () => {
      const button = fixture.nativeElement.querySelector(
        '[data-testid="google-oauth-button"]',
      );

      expect(button).toBeTruthy();
      expect(button.textContent).toContain('Continuer avec Google');
    });

    it('should have email signup button', () => {
      const button = fixture.nativeElement.querySelector(
        '[data-testid="email-signup-button"]',
      );

      expect(button).toBeTruthy();
      expect(button.textContent).toContain('Utiliser mon email');
    });

    it('should have demo mode button', () => {
      const button = fixture.nativeElement.querySelector(
        '[data-testid="demo-mode-button"]',
      );

      expect(button).toBeTruthy();
      expect(button.textContent).toContain('Essayer le mode démo');
    });

    it('should have login link', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const loginLink = Array.from(buttons).find(
        (btn) =>
          btn instanceof HTMLElement &&
          btn.textContent?.includes('Se connecter'),
      );

      expect(loginLink).toBeTruthy();
    });
  });

  describe('signInWithGoogle', () => {
    it('should call authApi.signInWithGoogle on success', async () => {
      mockAuthApi.signInWithGoogle.mockResolvedValue({ success: true });

      await component.signInWithGoogle();

      expect(mockAuthApi.signInWithGoogle).toHaveBeenCalled();
    });

    it('should display error message on failure', async () => {
      mockAuthApi.signInWithGoogle.mockResolvedValue({
        success: false,
        error: 'Auth failed',
      });

      await component.signInWithGoogle();
      fixture.detectChanges();

      const errorDiv = fixture.nativeElement.querySelector(
        '.bg-error-container',
      );
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.textContent).toContain('Auth failed');
    });

    it('should display default error message when no error provided', async () => {
      mockAuthApi.signInWithGoogle.mockResolvedValue({ success: false });

      await component.signInWithGoogle();
      fixture.detectChanges();

      const errorDiv = fixture.nativeElement.querySelector(
        '.bg-error-container',
      );
      expect(errorDiv.textContent).toContain(
        'Erreur lors de la connexion avec Google',
      );
    });

    it('should handle exception during Google sign in', async () => {
      mockAuthApi.signInWithGoogle.mockRejectedValue(
        new Error('Network error'),
      );

      await component.signInWithGoogle();
      fixture.detectChanges();

      const errorDiv = fixture.nativeElement.querySelector(
        '.bg-error-container',
      );
      expect(errorDiv).toBeTruthy();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('startDemoMode', () => {
    it('should bypass Turnstile in local environment', async () => {
      mockConfig.isLocal.mockReturnValue(true);
      mockDemoInitializer.startDemoSession.mockResolvedValue(undefined);

      await component.startDemoMode();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Turnstile skipped in local environment',
      );
      expect(mockDemoInitializer.startDemoSession).toHaveBeenCalledWith('');
    });

    it('should handle demo initialization error', async () => {
      mockConfig.isLocal.mockReturnValue(true);
      mockDemoInitializer.startDemoSession.mockRejectedValue(
        new Error('Demo failed'),
      );

      await component.startDemoMode();
      fixture.detectChanges();

      const errorDiv = fixture.nativeElement.querySelector(
        '.bg-error-container',
      );
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.textContent).toContain(
        'Impossible de démarrer le mode démo',
      );
    });

    it('should handle anti-robot error specifically', async () => {
      mockConfig.isLocal.mockReturnValue(true);
      mockDemoInitializer.startDemoSession.mockRejectedValue(
        new Error('anti-robot verification failed'),
      );

      await component.startDemoMode();
      fixture.detectChanges();

      const errorDiv = fixture.nativeElement.querySelector(
        '.bg-error-container',
      );
      expect(errorDiv.textContent).toContain('anti-robot');
    });
  });

  describe('onTurnstileResolved', () => {
    it('should start demo with token when resolved', () => {
      mockDemoInitializer.startDemoSession.mockResolvedValue(undefined);

      component.onTurnstileResolved('valid-token');

      expect(mockLogger.debug).toHaveBeenCalledWith('Turnstile resolved', {
        tokenLength: 11,
      });
    });

    it('should handle null token', () => {
      component.onTurnstileResolved(null);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Turnstile resolved with null token',
      );
    });
  });

  describe('onTurnstileError', () => {
    it('should log error and display message', () => {
      component.onTurnstileError();
      fixture.detectChanges();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Turnstile verification failed',
      );
      const errorDiv = fixture.nativeElement.querySelector(
        '.bg-error-container',
      );
      expect(errorDiv.textContent).toContain(
        'Échec de la vérification de sécurité',
      );
    });
  });

  describe('loading states', () => {
    it('should disable buttons when Google loading', () => {
      mockAuthApi.signInWithGoogle.mockImplementation(
        () => new Promise<void>(() => void 0),
      );

      component.signInWithGoogle();
      fixture.detectChanges();

      const googleButton = fixture.nativeElement.querySelector(
        '[data-testid="google-oauth-button"]',
      );
      const demoButton = fixture.nativeElement.querySelector(
        '[data-testid="demo-mode-button"]',
      );

      expect(googleButton.disabled).toBe(true);
      expect(demoButton.disabled).toBe(true);
    });

    it('should show spinner during Google loading', () => {
      mockAuthApi.signInWithGoogle.mockImplementation(
        () => new Promise<void>(() => void 0),
      );

      component.signInWithGoogle();
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector(
        'mat-progress-spinner',
      );
      expect(spinner).toBeTruthy();
    });
  });
});
