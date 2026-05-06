import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import type { UserSettings } from 'pulpe-shared';
import { AnalyticsService } from './analytics';
import { PostHogService } from './posthog';
import { AuthStore } from '../auth/auth-store';
import { Logger } from '../logging/logger';
import { DemoModeService } from '../demo/demo-mode.service';
import { UserSettingsStore } from '../user-settings/user-settings-store';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import {
  createMockPostHogService,
  createMockLogger,
} from '../../testing/mock-posthog';

const DEFAULT_SETTINGS: UserSettings = {
  payDayOfMonth: null,
  currency: 'CHF',
  showCurrencySelector: false,
};

function createMockUserSettingsStore(
  initial: UserSettings | null = DEFAULT_SETTINGS,
) {
  const settingsSignal = signal<UserSettings | null>(initial);
  return {
    settings: settingsSignal,
    setSettings: (value: UserSettings | null) => settingsSignal.set(value),
  };
}

function createMockFeatureFlagsService(initial = false) {
  const isMultiCurrencyEnabled = signal(initial);
  return {
    isMultiCurrencyEnabled,
    setEnabled: (value: boolean) => isMultiCurrencyEnabled.set(value),
  };
}

function expectedIdentifyProperties(
  userId: string,
  email?: string,
  name?: string,
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    supabase_user_id: userId,
    early_adopter: false,
  };
  if (email !== undefined) props['email'] = email;
  if (name !== undefined) props['name'] = name;
  return props;
}

describe('User consent and tracking behavior', () => {
  let analyticsService: AnalyticsService;
  let mockAuthState: ReturnType<typeof signal>;
  let mockPostHogService: ReturnType<typeof createMockPostHogService>;
  let mockUserSettingsStore: ReturnType<typeof createMockUserSettingsStore>;
  let mockFeatureFlagsService: ReturnType<typeof createMockFeatureFlagsService>;

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

    // Mock AuthStore
    const mockAuthStore = {
      authState: mockAuthState,
      isEarlyAdopter: signal(false),
    };

    const mockDemoModeService = {
      isDemoMode: signal(false),
    };

    mockUserSettingsStore = createMockUserSettingsStore();
    mockFeatureFlagsService = createMockFeatureFlagsService();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AnalyticsService,
        { provide: PostHogService, useValue: mockPostHogService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: Logger, useValue: mockLogger },
        { provide: DemoModeService, useValue: mockDemoModeService },
        { provide: UserSettingsStore, useValue: mockUserSettingsStore },
        { provide: FeatureFlagsService, useValue: mockFeatureFlagsService },
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
        expectedIdentifyProperties(userId, 'user@example.com'),
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
        expectedIdentifyProperties(returningUserId, 'returning@example.com'),
      );
    });
  });

  describe('when a user logs out', () => {
    it('should stop tracking but leave PostHog reset to AuthCleanupService', () => {
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

      // Then: AnalyticsService must NOT call reset() on anonymous tick —
      // reset() would wipe the cross-domain distinct_id bootstrapped from
      // the landing and the registered super properties. reset() is owned
      // by AuthCleanupService.performCleanup() on explicit signOut.
      expect(mockPostHogService.reset).not.toHaveBeenCalled();
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

  describe('currency person properties', () => {
    it('should push currency person properties via setPersonProperties once settings load', () => {
      // GIVEN: User has EUR + selector toggle on, multi-currency flag enabled
      mockUserSettingsStore.setSettings({
        payDayOfMonth: 25,
        currency: 'EUR',
        showCurrencySelector: true,
      });
      mockFeatureFlagsService.setEnabled(true);

      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      // WHEN: User authenticates
      mockAuthState.set({
        user: { id: 'user-currency-1', email: 'user@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });
      TestBed.tick();

      // THEN: Identify omits currency keys (only carries identity + early_adopter)
      expect(mockPostHogService.identify).toHaveBeenCalledWith(
        'user-currency-1',
        expectedIdentifyProperties('user-currency-1', 'user@example.com'),
      );
      // AND: setPersonProperties carries the currency triplet via $set
      expect(mockPostHogService.setPersonProperties).toHaveBeenCalledWith({
        currency: 'EUR',
        show_currency_selector: true,
        multi_currency_enabled: true,
      });
    });

    it('should not push person properties while user settings are still null', () => {
      // GIVEN: Settings still null (resource not resolved)
      mockUserSettingsStore.setSettings(null);
      mockFeatureFlagsService.setEnabled(false);

      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      mockAuthState.set({
        user: { id: 'user-currency-2', email: 'user@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });
      TestBed.tick();

      // THEN: Identify still fires (without currency keys), but setPersonProperties holds
      // until real settings arrive — avoids polluting the cohort with stale CHF defaults.
      expect(mockPostHogService.identify).toHaveBeenCalledWith(
        'user-currency-2',
        expectedIdentifyProperties('user-currency-2', 'user@example.com'),
      );
      expect(mockPostHogService.setPersonProperties).not.toHaveBeenCalled();
    });

    it('should push person properties once settings transition from null to loaded', () => {
      // GIVEN: Settings null at identify time
      mockUserSettingsStore.setSettings(null);
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      mockAuthState.set({
        user: { id: 'user-late-settings', email: 'user@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });
      TestBed.tick();
      expect(mockPostHogService.setPersonProperties).not.toHaveBeenCalled();

      // WHEN: Settings resource resolves
      mockUserSettingsStore.setSettings({
        payDayOfMonth: 1,
        currency: 'EUR',
        showCurrencySelector: false,
      });
      TestBed.tick();

      // THEN: Person properties are pushed with the real values
      expect(mockPostHogService.setPersonProperties).toHaveBeenCalledWith({
        currency: 'EUR',
        show_currency_selector: false,
        multi_currency_enabled: false,
      });
    });
  });

  describe('identify shape: email and name presence', () => {
    it('should include name when user_metadata.firstName is non-empty', () => {
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      mockAuthState.set({
        user: {
          id: 'user-with-name',
          email: 'alice@example.com',
          user_metadata: { firstName: 'Alice' },
        },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      TestBed.tick();

      expect(mockPostHogService.identify).toHaveBeenCalledWith(
        'user-with-name',
        expectedIdentifyProperties(
          'user-with-name',
          'alice@example.com',
          'Alice',
        ),
      );
    });

    it('should omit name when firstName is empty string', () => {
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      mockAuthState.set({
        user: {
          id: 'user-empty-name',
          email: 'bob@example.com',
          user_metadata: { firstName: '   ' },
        },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      TestBed.tick();

      const [, props] = mockPostHogService.identify.mock.calls[0];
      expect(props).not.toHaveProperty('name');
      expect(props).toMatchObject({
        supabase_user_id: 'user-empty-name',
        email: 'bob@example.com',
      });
    });

    it('should omit name when user_metadata is absent entirely', () => {
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      mockAuthState.set({
        user: { id: 'user-no-meta', email: 'carol@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      TestBed.tick();

      const [, props] = mockPostHogService.identify.mock.calls[0];
      expect(props).not.toHaveProperty('name');
    });

    it('should omit email when user.email is undefined', () => {
      TestBed.runInInjectionContext(() => {
        analyticsService.initializeAnalyticsTracking();
      });

      mockAuthState.set({
        user: { id: 'user-no-email', email: undefined },
        session: { access_token: 'token', refresh_token: 'refresh' },
        isLoading: false,
        isAuthenticated: true,
      });

      TestBed.tick();

      const [, props] = mockPostHogService.identify.mock.calls[0];
      expect(props).not.toHaveProperty('email');
      expect(props).toMatchObject({
        supabase_user_id: 'user-no-email',
        early_adopter: false,
      });
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
  let mockAuthState: WritableSignal<{
    user: { id: string; email: string } | null;
    session: { access_token: string; refresh_token: string } | null;
    isLoading: boolean;
    isAuthenticated: boolean;
  }>;

  beforeEach(() => {
    mockPostHogService = createMockPostHogService();

    mockAuthState = signal({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });

    const mockAuthStore = {
      authState: mockAuthState,
      isEarlyAdopter: signal(false),
    };

    const mockDemoModeService = {
      isDemoMode: signal(false),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AnalyticsService,
        { provide: PostHogService, useValue: mockPostHogService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: Logger, useValue: createMockLogger() },
        { provide: DemoModeService, useValue: mockDemoModeService },
        {
          provide: UserSettingsStore,
          useValue: createMockUserSettingsStore(),
        },
        {
          provide: FeatureFlagsService,
          useValue: createMockFeatureFlagsService(),
        },
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

  it('delegates setPersonProperties to PostHogService once identified', () => {
    const properties = { currency: 'EUR' };

    // Pre-identify gate: should no-op until identify has fired.
    analyticsService.setPersonProperties(properties);
    expect(mockPostHogService.setPersonProperties).not.toHaveBeenCalled();

    // Identify the user via the auth effect, then retry.
    TestBed.runInInjectionContext(() => {
      analyticsService.initializeAnalyticsTracking();
    });
    mockAuthState.set({
      user: { id: 'identified-user', email: 'user@example.com' },
      session: { access_token: 'token', refresh_token: 'refresh' },
      isLoading: false,
      isAuthenticated: true,
    });
    TestBed.tick();
    mockPostHogService.setPersonProperties.mockClear();

    analyticsService.setPersonProperties(properties);

    expect(mockPostHogService.setPersonProperties).toHaveBeenCalledWith(
      properties,
    );
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

    // Mock AuthStore
    const mockAuthStore = {
      authState: mockAuthState,
      isEarlyAdopter: signal(false),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AnalyticsService,
        { provide: PostHogService, useValue: mockPostHogService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: Logger, useValue: mockLogger },
        { provide: DemoModeService, useValue: mockDemoModeService },
        {
          provide: UserSettingsStore,
          useValue: createMockUserSettingsStore(),
        },
        {
          provide: FeatureFlagsService,
          useValue: createMockFeatureFlagsService(),
        },
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
        {
          ...expectedIdentifyProperties('demo-user-123', 'demo@pulpe.app'),
          is_demo: true,
        },
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
        expectedIdentifyProperties('real-user-456', 'user@example.com'),
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
        ...expectedIdentifyProperties('demo-user', 'demo@pulpe.app'),
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

      // THEN: AnalyticsService must NOT call reset() on anonymous tick.
      // Resetting here would destroy the cross-domain distinct_id and the
      // registered super properties. reset() lives in AuthCleanupService.
      expect(mockPostHogService.reset).not.toHaveBeenCalled();
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
        expectedIdentifyProperties('real-user', 'real@example.com'),
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
        ...expectedIdentifyProperties('user-123', 'user@example.com'),
        is_demo: true,
      });
    });
  });
});
