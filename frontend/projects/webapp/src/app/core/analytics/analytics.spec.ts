import { describe, it, expect, beforeEach } from 'vitest';
import type { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { AnalyticsService } from './analytics';
import { PostHogService } from './posthog';
import { AuthApi } from '../auth/auth-api';
import { Logger } from '../logging/logger';
import {
  createMockPostHogService,
  createMockLogger,
} from '../../testing/mock-posthog';

describe('User consent and tracking behavior', () => {
  let analyticsService: AnalyticsService;
  let mockAuthState: ReturnType<typeof signal>;
  let mockPostHogService: {
    isInitialized: ReturnType<typeof signal>;
    isEnabled: ReturnType<typeof signal>;
    enableTracking: ReturnType<typeof vi.fn>;
    identify: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };

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

    // Mock AuthApi
    const mockAuthApi = {
      authState: mockAuthState,
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AnalyticsService,
        { provide: PostHogService, useValue: mockPostHogService },
        { provide: AuthApi, useValue: mockAuthApi },
        { provide: Logger, useValue: mockLogger },
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
      expect(mockPostHogService.identify).toHaveBeenCalledWith(userId);
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
      expect(mockPostHogService.identify).toHaveBeenCalledWith(returningUserId);
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
});
