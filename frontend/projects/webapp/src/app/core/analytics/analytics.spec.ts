import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { AnalyticsService } from './analytics';
import { PostHogService } from './posthog';
import { AuthStateService } from '../auth/auth-state.service';
import { Logger } from '../logging/logger';
import { DemoModeService } from '../demo/demo-mode.service';
import {
  createMockPostHogService,
  createMockLogger,
} from '../../testing/mock-posthog';

describe('User consent and tracking behavior', () => {
  let analyticsService: AnalyticsService;
  let mockAuthState: ReturnType<typeof signal>;
  let mockPostHogService: ReturnType<typeof createMockPostHogService>;

  beforeEach(() => {
    // Create mock auth state signal
    mockAuthState = signal({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });

    // Use mock helpers
    mockPostHogService = createMockPostHogService();
    const mockLogger = createMockLogger();

    // Mock AuthStateService
    const mockAuthStateService = {
      authState: mockAuthState,
    };

    const mockDemoModeService = {
      isDemoMode: signal(false),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AnalyticsService,
        { provide: PostHogService, useValue: mockPostHogService },
        { provide: AuthStateService, useValue: mockAuthStateService },
        { provide: Logger, useValue: mockLogger },
        { provide: DemoModeService, useValue: mockDemoModeService },
      ],
    });

    analyticsService = TestBed.inject(AnalyticsService);
  });

  describe('when a new user registers', () => {
    it('should start tracking user actions after they accept terms and conditions', () => {
      // Given: Analytics is initialized
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      // When: A new user completes registration (simulated by auth state change)
      mockAuthState.set({
        user: { id: 'new-user-123', email: 'newuser@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      // Flush effects to trigger the auth state change handler
      TestBed.tick();

      // Then: User tracking should be enabled
      expect(mockPostHogService.enableTracking).toHaveBeenCalledTimes(1);
    });

    it('should identify the user for personalized analytics', () => {
      // Given: Analytics is initialized
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      // When: User authentication is confirmed
      const userId = 'user-456';
      mockAuthState.set({
        user: { id: userId, email: 'user@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      // Flush effects to trigger the auth state change handler
      TestBed.tick();

      // Then: User should be identified in analytics
      expect(mockPostHogService.identify).toHaveBeenCalledTimes(1);
      expect(mockPostHogService.identify).toHaveBeenCalledWith(
        userId,
        undefined,
      );
    });
  });

  describe('when an existing user logs in', () => {
    it('should resume tracking their actions automatically', () => {
      // Given: Analytics is initialized and user was logged out
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });
      mockPostHogService.enableTracking.mockClear();

      // When: Existing user logs in
      mockAuthState.set({
        user: { id: 'existing-user-789', email: 'existing@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      // Flush effects to trigger the auth state change handler
      TestBed.tick();

      // Then: Tracking should be automatically enabled
      expect(mockPostHogService.enableTracking).toHaveBeenCalledTimes(1);
    });

    it('should remember their identity across sessions', () => {
      // Given: Analytics is initialized
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      // When: User logs in with their existing account
      const returningUserId = 'returning-user-321';
      mockAuthState.set({
        user: { id: returningUserId, email: 'returning@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      // Flush effects to trigger the auth state change handler
      TestBed.tick();

      // Then: Their identity should be restored
      expect(mockPostHogService.identify).toHaveBeenCalledTimes(1);
      expect(mockPostHogService.identify).toHaveBeenCalledWith(
        returningUserId,
        undefined,
      );
    });
  });

  describe('when a user logs out', () => {
    it('should stop tracking and clear their session data', () => {
      // Given: User is logged in and being tracked
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });
      mockAuthState.set({
        user: { id: 'user-111', email: 'user@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      // Flush effects for the initial login
      TestBed.tick();
      expect(mockPostHogService.enableTracking).toHaveBeenCalledTimes(1);
      expect(mockPostHogService.identify).toHaveBeenCalledTimes(1);

      // When: User logs out
      mockAuthState.set({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });

      // Flush effects to trigger the auth state change handler
      TestBed.tick();

      // Then: Tracking should be disabled and identity cleared
      expect(mockPostHogService.reset).toHaveBeenCalledTimes(1);
    });

    it('should not track any actions until next login', () => {
      // Given: User has logged out
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });
      mockAuthState.set({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });

      // Then: No tracking should occur
      expect(mockPostHogService.enableTracking).not.toHaveBeenCalled();
      expect(mockPostHogService.identify).not.toHaveBeenCalled();
    });
  });

  describe('privacy compliance', () => {
    it('should never track users who have not accepted terms', () => {
      // Given: Analytics is initialized
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      // When: Auth state indicates no authenticated user
      mockAuthState.set({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });

      // Then: No tracking should be enabled
      expect(mockPostHogService.enableTracking).not.toHaveBeenCalled();
    });

    it('should only track once per authenticated session', () => {
      // Given: Analytics is initialized
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      // When: User authenticates
      const authState = {
        user: { id: 'user-999', email: 'user@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      };
      mockAuthState.set(authState);

      // Flush effects for the initial auth
      TestBed.tick();

      // Track initial state
      const initialCallCount =
        mockPostHogService.enableTracking.mock.calls.length;

      // When: Auth state is triggered again with same user (simulating multiple effects)
      mockAuthState.set({ ...authState });

      // Flush effects to trigger the auth state change handler
      TestBed.tick();

      // Then: Tracking should still be enabled but only from the first activation
      expect(mockPostHogService.enableTracking).toHaveBeenCalledTimes(1);
      expect(initialCallCount).toBe(1);
      // Note: In real implementation, enableTracking is only called once due to session flag
    });
  });

  describe('cleanup lifecycle', () => {
    it('should allow reinitialization after destroy', () => {
      // Given: analytics initialized and then destroyed
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      analyticsService.destroy();
      mockPostHogService.enableTracking.mockClear();

      // When: service is initialized again and user authenticates
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      mockAuthState.set({
        user: { id: 'user-reinit', email: 'user@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      TestBed.tick();

      // Then: tracking should be enabled for the new session
      expect(mockPostHogService.enableTracking).toHaveBeenCalledTimes(1);
    });
  });
});

describe('captureEvent', () => {
  let analyticsService: AnalyticsService;
  let mockPostHogService: ReturnType<typeof createMockPostHogService>;

  beforeEach(() => {
    mockPostHogService = createMockPostHogService();

    const mockAuthStateService = {
      authState: signal({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      }),
    };

    const mockDemoModeService = {
      isDemoMode: signal(false),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AnalyticsService,
        { provide: PostHogService, useValue: mockPostHogService },
        { provide: AuthStateService, useValue: mockAuthStateService },
        { provide: Logger, useValue: createMockLogger() },
        { provide: DemoModeService, useValue: mockDemoModeService },
      ],
    });

    analyticsService = TestBed.inject(AnalyticsService);
  });

  it('delegates captures to PostHogService', () => {
    const properties = { feature: 'onboarding', step: 'welcome' };

    analyticsService.captureEvent('user_action', properties);

    expect(mockPostHogService.captureEvent).toHaveBeenCalledWith(
      'user_action',
      properties,
    );
  });

  it('handles errors thrown by PostHogService', () => {
    const error = new Error('capture failed');
    mockPostHogService.captureEvent.mockImplementation(() => {
      throw error;
    });

    expect(() => analyticsService.captureEvent('failing_event')).toThrow(error);
  });
});

describe('Demo mode tracking', () => {
  let analyticsService: AnalyticsService;
  let mockAuthState: ReturnType<typeof signal>;
  let mockPostHogService: ReturnType<typeof createMockPostHogService>;
  let mockDemoModeService: { isDemoMode: WritableSignal<boolean> };

  beforeEach(() => {
    // Create mock auth state signal
    mockAuthState = signal({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });

    // Use mock helpers
    mockPostHogService = createMockPostHogService();
    const mockLogger = createMockLogger();

    // Mock DemoModeService
    mockDemoModeService = {
      isDemoMode: signal(false),
    };

    // Mock AuthStateService
    const mockAuthStateService = {
      authState: mockAuthState,
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AnalyticsService,
        { provide: PostHogService, useValue: mockPostHogService },
        { provide: AuthStateService, useValue: mockAuthStateService },
        { provide: Logger, useValue: mockLogger },
        { provide: DemoModeService, useValue: mockDemoModeService },
      ],
    });

    analyticsService = TestBed.inject(AnalyticsService);
  });

  describe('User uses demo mode', () => {
    it('should identify demo users with is_demo flag', () => {
      // GIVEN: Demo mode is active
      mockDemoModeService.isDemoMode.set(true);

      // AND: Analytics is initialized
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      // WHEN: User authenticates in demo mode
      mockAuthState.set({
        user: { id: 'demo-user-123', email: 'demo@pulpe.app' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      TestBed.tick();

      // THEN: User is identified with is_demo flag
      expect(mockPostHogService.identify).toHaveBeenCalledWith(
        'demo-user-123',
        { is_demo: true },
      );
    });

    it('should NOT add is_demo flag for regular users', () => {
      // GIVEN: Demo mode is OFF
      mockDemoModeService.isDemoMode.set(false);

      // AND: Analytics is initialized
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      // WHEN: Regular user authenticates
      mockAuthState.set({
        user: { id: 'real-user-456', email: 'user@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      TestBed.tick();

      // THEN: User is identified WITHOUT is_demo flag
      expect(mockPostHogService.identify).toHaveBeenCalledWith(
        'real-user-456',
        undefined,
      );
    });
  });

  describe('User switches from demo to regular mode', () => {
    it('should clear demo flag when user exits demo mode', () => {
      // GIVEN: User was in demo mode
      mockDemoModeService.isDemoMode.set(true);

      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      mockAuthState.set({
        user: { id: 'demo-user', email: 'demo@pulpe.app' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      TestBed.tick();
      expect(mockPostHogService.identify).toHaveBeenCalledWith('demo-user', {
        is_demo: true,
      });

      // WHEN: User exits demo mode and logs out
      mockDemoModeService.isDemoMode.set(false);
      mockAuthState.set({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });

      TestBed.tick();

      // THEN: Analytics session is reset
      expect(mockPostHogService.reset).toHaveBeenCalled();
    });

    it('should identify regular user without demo flag after demo logout', () => {
      // GIVEN: User was in demo mode and logged out
      mockDemoModeService.isDemoMode.set(true);

      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      mockAuthState.set({
        user: { id: 'demo-user', email: 'demo@pulpe.app' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      TestBed.tick();

      // User logs out
      mockDemoModeService.isDemoMode.set(false);
      mockAuthState.set({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });

      TestBed.tick();
      mockPostHogService.identify.mockClear();

      // WHEN: Regular user logs in after demo mode was cleared
      mockAuthState.set({
        user: { id: 'real-user', email: 'real@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      TestBed.tick();

      // THEN: Regular user is identified without demo flag
      expect(mockPostHogService.identify).toHaveBeenCalledWith(
        'real-user',
        undefined,
      );
    });
  });

  describe('Demo mode state changes', () => {
    it('should re-identify user when demo mode changes while authenticated', () => {
      // GIVEN: Regular user is authenticated
      mockDemoModeService.isDemoMode.set(false);

      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      mockAuthState.set({
        user: { id: 'user-123', email: 'user@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      TestBed.tick();
      mockPostHogService.identify.mockClear();

      // WHEN: Demo mode is activated (edge case: shouldn't normally happen)
      mockDemoModeService.isDemoMode.set(true);

      TestBed.tick();

      // THEN: User is re-identified with demo flag
      expect(mockPostHogService.identify).toHaveBeenCalledWith('user-123', {
        is_demo: true,
      });
    });
  });
});
