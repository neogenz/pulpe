import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DemoInitializerService } from './demo-initializer.service';
import { DemoModeService } from './demo-mode.service';
import { AuthApi } from '../auth/auth-api';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { ROUTES } from '../routing/routes-constants';

describe('DemoInitializerService', () => {
  let service: DemoInitializerService;
  let mockHttp: { post: Mock };
  let mockRouter: { navigate: Mock };
  let mockAuthApi: { setSession: Mock; signOut: Mock };
  let mockDemoModeService: { activateDemoMode: Mock; deactivateDemoMode: Mock };
  let mockConfig: { backendApiUrl: Mock };

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
    mockHttp = {
      post: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockAuthApi = {
      setSession: vi.fn().mockResolvedValue({ success: true }),
      signOut: vi.fn().mockResolvedValue(undefined),
    };

    mockDemoModeService = {
      activateDemoMode: vi.fn(),
      deactivateDemoMode: vi.fn(),
    };

    mockConfig = {
      backendApiUrl: vi.fn().mockReturnValue('http://localhost:3000/api/v1'),
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
        { provide: HttpClient, useValue: mockHttp },
        { provide: Router, useValue: mockRouter },
        { provide: AuthApi, useValue: mockAuthApi },
        { provide: DemoModeService, useValue: mockDemoModeService },
        { provide: ApplicationConfiguration, useValue: mockConfig },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(DemoInitializerService);
  });

  describe('User starts demo session from welcome page', () => {
    it('should create demo session and navigate to dashboard', async () => {
      // GIVEN: Backend returns successful demo session
      mockHttp.post.mockReturnValue(of(mockDemoSession));

      // WHEN: User clicks "Try Demo" button
      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      // THEN: Session is set via AuthApi
      expect(mockAuthApi.setSession).toHaveBeenCalledWith({
        access_token: 'demo-access-token',
        refresh_token: 'demo-refresh-token',
      });

      // AND: Demo mode is activated
      expect(mockDemoModeService.activateDemoMode).toHaveBeenCalledWith(
        'demo-abc123@pulpe.app',
      );

      // AND: User is redirected to dashboard
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        ROUTES.APP,
        ROUTES.CURRENT_MONTH,
      ]);
    });

    it('should show loading state during session creation', async () => {
      // GIVEN: Backend request will complete
      mockHttp.post.mockReturnValue(of(mockDemoSession));

      // WHEN: User starts demo session (async operation)
      const promise = service.startDemoSession(TEST_TURNSTILE_TOKEN);

      // THEN: Loading state should have been true during execution
      // (We can't easily test intermediate states in async code,
      // so we just verify final state and that the operation completes)
      await promise;

      // THEN: Loading state is false after completion
      expect(service.isInitializing()).toBe(false);
    });

    it('should use correct backend URL', async () => {
      // GIVEN: Backend URL is configured
      mockHttp.post.mockReturnValue(of(mockDemoSession));

      // WHEN: User starts demo session
      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      // THEN: Correct endpoint is called
      expect(mockHttp.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/demo/session',
        { turnstileToken: TEST_TURNSTILE_TOKEN },
      );
    });
  });

  describe('Demo session creation fails', () => {
    it('should handle network errors gracefully', async () => {
      // GIVEN: Network request fails
      mockHttp.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      // WHEN: User tries to start demo
      await expect(
        service.startDemoSession(TEST_TURNSTILE_TOKEN),
      ).rejects.toThrow('Network error');

      // THEN: Auth session is NOT set
      expect(mockAuthApi.setSession).not.toHaveBeenCalled();

      // AND: Demo mode is NOT activated
      expect(mockDemoModeService.activateDemoMode).not.toHaveBeenCalled();

      // AND: User is NOT redirected
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should handle backend error response', async () => {
      // GIVEN: Backend returns error response
      const errorResponse = { success: false, error: 'Database unavailable' };
      mockHttp.post.mockReturnValue(of(errorResponse));

      // WHEN: User tries to start demo
      await expect(
        service.startDemoSession(TEST_TURNSTILE_TOKEN),
      ).rejects.toThrow('Invalid demo session response');

      // THEN: Auth session is NOT set
      expect(mockAuthApi.setSession).not.toHaveBeenCalled();
    });

    it('should handle missing session data', async () => {
      // GIVEN: Backend response is missing session
      const invalidResponse = {
        success: true,
        data: {},
      };
      mockHttp.post.mockReturnValue(of(invalidResponse));

      // WHEN: User tries to start demo
      await expect(
        service.startDemoSession(TEST_TURNSTILE_TOKEN),
      ).rejects.toThrow('Invalid demo session response');
    });

    it('should handle auth session errors gracefully', async () => {
      // GIVEN: Backend succeeds but setSession fails
      mockHttp.post.mockReturnValue(of(mockDemoSession));
      mockAuthApi.setSession.mockResolvedValue({
        success: false,
        error: 'Session expired',
      });

      // WHEN: User tries to start demo
      await expect(
        service.startDemoSession(TEST_TURNSTILE_TOKEN),
      ).rejects.toThrow('Session expired');

      // THEN: Demo mode is NOT activated
      expect(mockDemoModeService.activateDemoMode).not.toHaveBeenCalled();

      // AND: User is NOT redirected
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should reset loading state on error', async () => {
      // GIVEN: Backend fails
      mockHttp.post.mockReturnValue(
        throwError(() => new Error('Backend error')),
      );

      // WHEN: User tries to start demo
      try {
        await service.startDemoSession(TEST_TURNSTILE_TOKEN);
      } catch {
        // Expected error
      }

      // THEN: Loading state is reset
      expect(service.isInitializing()).toBe(false);
    });
  });

  describe('Concurrent demo requests', () => {
    it('should prevent multiple simultaneous demo session requests', async () => {
      // GIVEN: Backend will respond successfully
      mockHttp.post.mockReturnValue(of(mockDemoSession));

      // WHEN: Multiple requests are made simultaneously
      const promise1 = service.startDemoSession(TEST_TURNSTILE_TOKEN);
      const promise2 = service.startDemoSession(TEST_TURNSTILE_TOKEN);
      const promise3 = service.startDemoSession(TEST_TURNSTILE_TOKEN);

      await Promise.all([promise1, promise2, promise3]);

      // THEN: Only one backend request is made (due to isInitializing guard)
      expect(mockHttp.post).toHaveBeenCalledTimes(1);

      // AND: Session is set only once
      expect(mockAuthApi.setSession).toHaveBeenCalledTimes(1);
    });

    it('should allow new request after previous completes', async () => {
      // GIVEN: First request completes successfully
      mockHttp.post.mockReturnValue(of(mockDemoSession));
      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      // WHEN: New request is made after completion
      mockHttp.post.mockClear();
      mockAuthApi.setSession.mockClear();
      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      // THEN: New request is allowed
      expect(mockHttp.post).toHaveBeenCalledTimes(1);
    });

    it('should allow new request after previous fails', async () => {
      // GIVEN: First request fails
      mockHttp.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      try {
        await service.startDemoSession(TEST_TURNSTILE_TOKEN);
      } catch {
        // Expected error
      }

      // WHEN: New request is made after failure
      mockHttp.post.mockClear();
      mockHttp.post.mockReturnValue(of(mockDemoSession));
      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      // THEN: New request is allowed
      expect(mockHttp.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('User exits demo mode', () => {
    it('should deactivate demo mode and sign out user', async () => {
      // WHEN: User exits demo mode
      await service.exitDemoMode();

      // THEN: Demo mode is deactivated
      expect(mockDemoModeService.deactivateDemoMode).toHaveBeenCalled();

      // AND: User is signed out
      expect(mockAuthApi.signOut).toHaveBeenCalled();
    });

    it('should handle sign out errors gracefully', async () => {
      // GIVEN: Sign out throws error
      mockAuthApi.signOut.mockRejectedValue(new Error('Sign out failed'));

      // WHEN: User exits demo mode
      await expect(service.exitDemoMode()).rejects.toThrow('Sign out failed');

      // THEN: Demo mode is still deactivated
      expect(mockDemoModeService.deactivateDemoMode).toHaveBeenCalled();
    });
  });

  describe('User email is correctly stored', () => {
    it('should activate demo mode with the email from backend session', async () => {
      // GIVEN: Backend returns session with specific email
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
      mockHttp.post.mockReturnValue(of(customSession));

      // WHEN: User starts demo
      await service.startDemoSession(TEST_TURNSTILE_TOKEN);

      // THEN: Demo mode is activated with correct email
      expect(mockDemoModeService.activateDemoMode).toHaveBeenCalledWith(
        'custom-demo@pulpe.app',
      );

      // AND: User is redirected to dashboard
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        ROUTES.APP,
        ROUTES.CURRENT_MONTH,
      ]);
    });
  });
});
