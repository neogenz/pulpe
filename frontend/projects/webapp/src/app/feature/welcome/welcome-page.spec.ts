import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import WelcomePage from './welcome-page';
import { DemoInitializerService } from '@core/demo/demo-initializer.service';
import { Logger } from '@core/logging/logger';
import { TurnstileService } from '@core/turnstile';
import { PostHogService } from '@core/analytics/posthog';

describe('WelcomePage', () => {
  let fixture: ComponentFixture<WelcomePage>;
  let component: WelcomePage;
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
  let mockTurnstileService: {
    isProcessing: ReturnType<typeof signal<boolean>>;
    shouldRender: ReturnType<typeof signal<boolean>>;
    siteKey: Mock;
    shouldUseTurnstile: Mock;
    startVerification: Mock;
    handleResolved: Mock;
    handleError: Mock;
    reset: Mock;
  };
  let mockPostHogService: {
    captureEvent: Mock;
  };

  beforeEach(async () => {
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

    mockTurnstileService = {
      isProcessing: signal(false),
      shouldRender: signal(false),
      siteKey: vi.fn().mockReturnValue('test-site-key'),
      shouldUseTurnstile: vi.fn().mockReturnValue(true),
      startVerification: vi.fn(),
      handleResolved: vi.fn(),
      handleError: vi.fn(),
      reset: vi.fn(),
    };

    mockPostHogService = {
      captureEvent: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [WelcomePage, NoopAnimationsModule, RouterModule.forRoot([])],
      providers: [
        { provide: DemoInitializerService, useValue: mockDemoInitializer },
        { provide: Logger, useValue: mockLogger },
        { provide: TurnstileService, useValue: mockTurnstileService },
        { provide: PostHogService, useValue: mockPostHogService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should instantiate welcome page component', () => {
    expect(component).toBeTruthy();
  });

  describe('template', () => {
    it('should display welcome title', () => {
      const title = fixture.nativeElement.querySelector(
        '[data-testid="welcome-title"]',
      );

      expect(title.textContent).toContain('Vois clair dans tes finances');
    });

    it('should display value proposition', () => {
      const subtitle = fixture.nativeElement.querySelector(
        '[data-testid="welcome-subtitle"]',
      ) as HTMLElement;

      expect(subtitle).toBeTruthy();
      expect(subtitle?.textContent).toContain(
        'Planifie ton année, sache toujours ce que tu peux dépenser',
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
      expect(button.textContent).toContain("S'inscrire par e-mail");
    });

    it('should have demo mode button', () => {
      const loadingButton = fixture.nativeElement.querySelector(
        'pulpe-loading-button[testId="demo-mode-button"]',
      );

      expect(loadingButton).toBeTruthy();
      expect(loadingButton.textContent).toContain('Essayer sans compte');
    });

    it('should have login link', () => {
      const loginLink = fixture.nativeElement.querySelector(
        '[data-testid="demo-link"]',
      ) as HTMLElement;

      expect(loginLink).toBeTruthy();
    });
  });

  describe('startDemoMode', () => {
    it('should call turnstile service startVerification', () => {
      component.startDemoMode();

      expect(mockTurnstileService.startVerification).toHaveBeenCalled();
    });

    it('should clear error message when starting demo', () => {
      component.startDemoMode();

      expect(mockTurnstileService.startVerification).toHaveBeenCalled();
    });

    it('should handle demo initialization error', async () => {
      mockDemoInitializer.startDemoSession.mockRejectedValue(
        new Error('Demo failed'),
      );

      mockTurnstileService.startVerification.mockImplementation(
        (_widget: unknown, onToken: (token: string) => void) => {
          onToken('test-token');
        },
      );

      component.startDemoMode();
      await fixture.whenStable();
      fixture.detectChanges();

      const errorAlert =
        fixture.nativeElement.querySelector('pulpe-error-alert');
      expect(errorAlert).toBeTruthy();
    });

    it('should call demoInitializer when token is received', async () => {
      mockDemoInitializer.startDemoSession.mockResolvedValue(undefined);

      mockTurnstileService.startVerification.mockImplementation(
        (_widget: unknown, onToken: (token: string) => void) => {
          onToken('valid-token');
        },
      );

      component.startDemoMode();
      await fixture.whenStable();

      expect(mockDemoInitializer.startDemoSession).toHaveBeenCalledWith(
        'valid-token',
      );
    });

    it('should set error message when turnstile reports error', () => {
      mockTurnstileService.startVerification.mockImplementation(
        (
          _widget: unknown,
          _onToken: unknown,
          onError: (message: string) => void,
        ) => {
          onError('La vérification de sécurité a échoué — réessaie');
        },
      );

      component.startDemoMode();
      fixture.detectChanges();

      const errorAlert =
        fixture.nativeElement.querySelector('pulpe-error-alert');
      expect(errorAlert).toBeTruthy();
    });
  });

  describe('CGU text', () => {
    it('should display CGU text under Google OAuth button', () => {
      const cguText = fixture.nativeElement.querySelector(
        '[data-testid="app-version"]',
      );

      expect(cguText).toBeTruthy();
      expect(cguText.textContent).toContain('CGU');
      expect(cguText.textContent).toContain('Politique de Confidentialité');
    });
  });

  describe('analytics', () => {
    it('should track signup_started with google method when OAuth loading', () => {
      component.onGoogleLoadingChange(true);

      expect(mockPostHogService.captureEvent).toHaveBeenCalledWith(
        'signup_started',
        { method: 'google' },
      );
    });

    it('should not track signup_started when OAuth stops loading', () => {
      component.onGoogleLoadingChange(false);

      expect(mockPostHogService.captureEvent).not.toHaveBeenCalled();
    });

    it('should track signup_started with email method on email click', () => {
      component.onEmailSignupClick();

      expect(mockPostHogService.captureEvent).toHaveBeenCalledWith(
        'signup_started',
        { method: 'email' },
      );
    });
  });
});
