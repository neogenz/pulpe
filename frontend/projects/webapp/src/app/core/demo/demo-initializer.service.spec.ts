import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DemoInitializerService } from './demo-initializer.service';
import { DemoModeService } from './demo-mode.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { ApiClient } from '../api/api-client';
import { ApiError } from '../api/api-error';
import { ROUTES } from '../routing/routes-constants';
import { Logger } from '../logging/logger';

describe('DemoInitializerService', () => {
  let service: DemoInitializerService;
  let mockApi: { post$: Mock };
  let mockRouter: { navigate: Mock };
  let mockAuthSessionService: { setSession: Mock; signOut: Mock };
  let mockDemoModeService: {
    activateDemoMode: Mock;
    deactivateDemoMode: Mock;
  };

  const TEST_TURNSTILE_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

  const mockDemoSession = {
    success: true,
    data: {
      session: {
        access_token: 'demo-access-token',
        refresh_token: 'demo-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        user: {
          id: 'demo-user-id',
          email: 'demo-abc123@pulpe.app',
          created_at: new Date().toISOString(),
        },
      },
    },
    message: 'Demo session created',
  };

  beforeEach(() => {
    mockApi = {
      post$: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockAuthSessionService = {
      setSession: vi.fn().mockResolvedValue({ success: true }),
      signOut: vi.fn().mockResolvedValue(undefined),
    };

    mockDemoModeService = {
      activateDemoMode: vi.fn(),
      deactivateDemoMode: vi.fn(),
    };

    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        DemoInitializerService,
        { provide: ApiClient, useValue: mockApi },
        { provide: Router, useValue: mockRouter },
        { provide: AuthSessionService, useValue: mockAuthSessionService },
        { provide: DemoModeService, useValue: mockDemoModeService },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(DemoInitializerService);
  });

  describe('User starts demo session from welcome page', () => {
    it('should create demo session and navigate to dashboard', async () => {
      mockApi.post$.mockReturnValue(of(mockDemoSession));

      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      expect(mockAuthSessionService.setSession).toHaveBeenCalledWith({
        access_token: 'demo-access-token',
        refresh_token: 'demo-refresh-token',
      });

      expect(mockDemoModeService.activateDemoMode).toHaveBeenCalledWith(
        'demo-abc123@pulpe.app',
      );

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/', ROUTES.DASHBOARD]);
    });

    it('should show loading state during session creation', async () => {
      mockApi.post$.mockReturnValue(of(mockDemoSession));

      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      expect(service.isInitializing()).toBe(false);
    });

    it('should call ApiClient with correct path and payload', async () => {
      mockApi.post$.mockReturnValue(of(mockDemoSession));

      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      expect(mockApi.post$).toHaveBeenCalledWith(
        '/demo/session',
        { turnstileToken: TEST_TURNSTILE_TOKEN },
        expect.any(Object),
      );
    });
  });

  describe('Demo session creation fails', () => {
    it('should handle network errors gracefully', async () => {
      mockApi.post$.mockReturnValue(
        throwError(
          () => new ApiError('Network error', undefined, 0, undefined),
        ),
      );

      await expect(
        service.startDemoSession(TEST_TURNSTILE_TOKEN),
      ).rejects.toThrow(
        'Impossible de contacter le serveur. Vérifiez votre connexion internet.',
      );

      expect(mockAuthSessionService.setSession).not.toHaveBeenCalled();
      expect(mockDemoModeService.activateDemoMode).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should handle backend error response (5xx)', async () => {
      mockApi.post$.mockReturnValue(
        throwError(
          () =>
            new ApiError('Internal Server Error', undefined, 500, undefined),
        ),
      );

      await expect(
        service.startDemoSession(TEST_TURNSTILE_TOKEN),
      ).rejects.toThrow(
        'Le serveur rencontre un problème — réessaie dans quelques instants',
      );

      expect(mockAuthSessionService.setSession).not.toHaveBeenCalled();
    });

    it('should handle rate limiting (429)', async () => {
      mockApi.post$.mockReturnValue(
        throwError(
          () => new ApiError('Too Many Requests', undefined, 429, undefined),
        ),
      );

      await expect(
        service.startDemoSession(TEST_TURNSTILE_TOKEN),
      ).rejects.toThrow('Trop de tentatives — patiente avant de réessayer');
    });

    it('should re-throw non-ApiError errors', async () => {
      mockApi.post$.mockReturnValue(
        throwError(() => new Error('Unknown error')),
      );

      await expect(
        service.startDemoSession(TEST_TURNSTILE_TOKEN),
      ).rejects.toThrow('Unknown error');
    });

    it('should handle auth session errors gracefully', async () => {
      mockApi.post$.mockReturnValue(of(mockDemoSession));
      mockAuthSessionService.setSession.mockResolvedValue({
        success: false,
        error: 'Session expired',
      });

      await expect(
        service.startDemoSession(TEST_TURNSTILE_TOKEN),
      ).rejects.toThrow('Session expired');

      expect(mockDemoModeService.activateDemoMode).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should reset loading state on error', async () => {
      mockApi.post$.mockReturnValue(
        throwError(() => new Error('Backend error')),
      );

      try {
        await service.startDemoSession(TEST_TURNSTILE_TOKEN);
      } catch {
        // Expected error
      }

      expect(service.isInitializing()).toBe(false);
    });
  });

  describe('Concurrent demo requests', () => {
    it('should prevent multiple simultaneous demo session requests', async () => {
      mockApi.post$.mockReturnValue(of(mockDemoSession));

      const promise1 = service.startDemoSession(TEST_TURNSTILE_TOKEN);
      const promise2 = service.startDemoSession(TEST_TURNSTILE_TOKEN);
      const promise3 = service.startDemoSession(TEST_TURNSTILE_TOKEN);

      await Promise.all([promise1, promise2, promise3]);

      expect(mockApi.post$).toHaveBeenCalledTimes(1);
      expect(mockAuthSessionService.setSession).toHaveBeenCalledTimes(1);
    });

    it('should allow new request after previous completes', async () => {
      mockApi.post$.mockReturnValue(of(mockDemoSession));
      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      mockApi.post$.mockClear();
      mockAuthSessionService.setSession.mockClear();
      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      expect(mockApi.post$).toHaveBeenCalledTimes(1);
    });

    it('should allow new request after previous fails', async () => {
      mockApi.post$.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      try {
        await service.startDemoSession(TEST_TURNSTILE_TOKEN);
      } catch {
        // Expected error
      }

      mockApi.post$.mockClear();
      mockApi.post$.mockReturnValue(of(mockDemoSession));
      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      expect(mockApi.post$).toHaveBeenCalledTimes(1);
    });
  });

  describe('User exits demo mode', () => {
    it('should deactivate demo mode and sign out user', async () => {
      await service.exitDemoMode();

      expect(mockDemoModeService.deactivateDemoMode).toHaveBeenCalled();
      expect(mockAuthSessionService.signOut).toHaveBeenCalled();
    });

    it('should handle sign out errors gracefully', async () => {
      mockAuthSessionService.signOut.mockRejectedValue(
        new Error('Sign out failed'),
      );

      await expect(service.exitDemoMode()).rejects.toThrow('Sign out failed');

      expect(mockDemoModeService.deactivateDemoMode).toHaveBeenCalled();
    });
  });

  describe('User email is correctly stored', () => {
    it('should activate demo mode with the email from backend session', async () => {
      const customSession = {
        ...mockDemoSession,
        data: {
          session: {
            ...mockDemoSession.data.session,
            user: {
              ...mockDemoSession.data.session.user,
              email: 'custom-demo@pulpe.app',
            },
          },
        },
      };
      mockApi.post$.mockReturnValue(of(customSession));

      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      expect(mockDemoModeService.activateDemoMode).toHaveBeenCalledWith(
        'custom-demo@pulpe.app',
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/', ROUTES.DASHBOARD]);
    });
  });
});
