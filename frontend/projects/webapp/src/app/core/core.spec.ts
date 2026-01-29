import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  ApplicationInitStatus,
  provideZonelessChangeDetection,
  provideAppInitializer,
  inject,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { ApplicationConfiguration } from './config/application-configuration';
import { PostHogService } from './analytics/posthog';
import { AuthSessionService } from './auth/auth-session.service';
import { AnalyticsService } from './analytics/analytics';
import { StorageMigrationRunnerService } from './storage/storage-migration-runner.service';
import { Logger } from './logging/logger';

describe('provideAppInitializer (core)', () => {
  let mockConfig: {
    initialize: Mock;
    isDevelopment: Mock;
    environment: Mock;
    supabaseUrl: Mock;
    supabaseAnonKey: Mock;
    backendApiUrl: Mock;
    postHog: Mock;
  };
  let mockPostHog: { initialize: Mock };
  let mockAuthSession: { initializeAuthState: Mock };
  let mockAnalytics: { initializeAnalyticsTracking: Mock; isActive: Mock };
  let mockMigrationRunner: { runMigrations: Mock };
  let mockLogger: {
    info: Mock;
    debug: Mock;
    warn: Mock;
    error: Mock;
  };

  beforeEach(() => {
    mockConfig = {
      initialize: vi.fn().mockResolvedValue(undefined),
      isDevelopment: vi.fn().mockReturnValue(false),
      environment: vi.fn().mockReturnValue('development'),
      supabaseUrl: vi.fn().mockReturnValue('http://localhost'),
      supabaseAnonKey: vi.fn().mockReturnValue('key'),
      backendApiUrl: vi.fn().mockReturnValue('http://localhost/api'),
      postHog: vi.fn().mockReturnValue({
        enabled: false,
        host: '',
        apiKey: '',
      }),
    };
    mockPostHog = {
      initialize: vi.fn().mockResolvedValue(undefined),
    };
    mockAuthSession = {
      initializeAuthState: vi.fn().mockResolvedValue(undefined),
    };
    mockAnalytics = {
      initializeAnalyticsTracking: vi.fn(),
      isActive: vi.fn().mockReturnValue(false),
    };
    mockMigrationRunner = {
      runMigrations: vi.fn(),
    };
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  function configureTestBed() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ApplicationConfiguration, useValue: mockConfig },
        { provide: PostHogService, useValue: mockPostHog },
        { provide: AuthSessionService, useValue: mockAuthSession },
        { provide: AnalyticsService, useValue: mockAnalytics },
        {
          provide: StorageMigrationRunnerService,
          useValue: mockMigrationRunner,
        },
        { provide: Logger, useValue: mockLogger },
        provideAppInitializer(async () => {
          const applicationConfig = inject(ApplicationConfiguration);
          const postHogService = inject(PostHogService);
          const authSession = inject(AuthSessionService);
          const analyticsService = inject(AnalyticsService);
          const storageMigrationRunner = inject(StorageMigrationRunnerService);
          const injector = inject(Injector);
          const logger = inject(Logger);

          storageMigrationRunner.runMigrations();
          await applicationConfig.initialize();

          const initPostHog = async () => {
            try {
              await postHogService.initialize();
              runInInjectionContext(injector, () => {
                analyticsService.initializeAnalyticsTracking();
                logger.debug('Analytics service ready', {
                  isActive: analyticsService.isActive(),
                });
              });
            } catch (postHogError) {
              if (applicationConfig.isDevelopment()) {
                throw postHogError;
              }
              logger.warn(
                'PostHog initialization failed, continuing without analytics',
                postHogError,
              );
            }
          };

          try {
            await Promise.all([
              initPostHog(),
              authSession.initializeAuthState(),
            ]);
          } catch (error) {
            logger.error("Erreur lors de l'initialisation", error);
            throw error;
          }
        }),
      ],
    });

    return TestBed.inject(ApplicationInitStatus).donePromise;
  }

  it('should run storage migrations before config', async () => {
    // GIVEN: all services resolve normally
    const callOrder: string[] = [];
    mockMigrationRunner.runMigrations.mockImplementation(() => {
      callOrder.push('migrations');
    });
    mockConfig.initialize.mockImplementation(async () => {
      callOrder.push('config');
    });

    // WHEN: app initializes
    await configureTestBed();

    // THEN: migrations run before config
    expect(callOrder[0]).toBe('migrations');
    expect(callOrder[1]).toBe('config');
  });

  it('should load config before PostHog and Auth', async () => {
    // GIVEN: track call order
    let configResolved = false;
    mockConfig.initialize.mockImplementation(async () => {
      configResolved = true;
    });
    mockPostHog.initialize.mockImplementation(async () => {
      expect(configResolved).toBe(true);
    });
    mockAuthSession.initializeAuthState.mockImplementation(async () => {
      expect(configResolved).toBe(true);
    });

    // WHEN: app initializes
    await configureTestBed();

    // THEN: all services were called
    expect(mockConfig.initialize).toHaveBeenCalled();
    expect(mockPostHog.initialize).toHaveBeenCalled();
    expect(mockAuthSession.initializeAuthState).toHaveBeenCalled();
  });

  it('should run PostHog and Auth in parallel', async () => {
    // GIVEN: track when each starts and ends
    const events: string[] = [];
    mockPostHog.initialize.mockImplementation(async () => {
      events.push('posthog:start');
      await new Promise((r) => setTimeout(r, 10));
      events.push('posthog:end');
    });
    mockAuthSession.initializeAuthState.mockImplementation(async () => {
      events.push('auth:start');
      await new Promise((r) => setTimeout(r, 10));
      events.push('auth:end');
    });

    // WHEN: app initializes
    await configureTestBed();

    // THEN: both start before either ends (parallel execution)
    const posthogStartIdx = events.indexOf('posthog:start');
    const authStartIdx = events.indexOf('auth:start');
    const posthogEndIdx = events.indexOf('posthog:end');
    const authEndIdx = events.indexOf('auth:end');

    // Both should start before the first one ends
    expect(posthogStartIdx).toBeLessThan(posthogEndIdx);
    expect(authStartIdx).toBeLessThan(authEndIdx);
    expect(Math.max(posthogStartIdx, authStartIdx)).toBeLessThan(
      Math.min(posthogEndIdx, authEndIdx),
    );
  });

  it('should swallow PostHog failure in production', async () => {
    // GIVEN: PostHog fails, not in development
    mockPostHog.initialize.mockRejectedValue(new Error('PostHog down'));
    mockConfig.isDevelopment.mockReturnValue(false);

    // WHEN: app initializes
    await configureTestBed();

    // THEN: app still starts, auth was called, warning logged
    expect(mockAuthSession.initializeAuthState).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'PostHog initialization failed, continuing without analytics',
      expect.any(Error),
    );
  });

  it('should throw PostHog failure in development', async () => {
    // GIVEN: PostHog fails in development mode
    mockPostHog.initialize.mockRejectedValue(new Error('PostHog down'));
    mockConfig.isDevelopment.mockReturnValue(true);

    // WHEN/THEN: initialization throws
    await expect(configureTestBed()).rejects.toThrow('PostHog down');
  });

  it('should throw if Auth initialization fails', async () => {
    // GIVEN: Auth fails
    mockAuthSession.initializeAuthState.mockRejectedValue(
      new Error('Auth unavailable'),
    );

    // WHEN/THEN: initialization throws
    await expect(configureTestBed()).rejects.toThrow('Auth unavailable');
  });

  it('should initialize analytics tracking after PostHog', async () => {
    // GIVEN: normal flow
    // WHEN: app initializes
    await configureTestBed();

    // THEN: analytics tracking initialized
    expect(mockAnalytics.initializeAnalyticsTracking).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Analytics service ready',
      expect.objectContaining({ isActive: false }),
    );
  });

  it('should throw if config initialization fails', async () => {
    // GIVEN: config fetch fails
    mockConfig.initialize.mockRejectedValue(
      new Error('Failed to fetch config.json'),
    );

    // WHEN/THEN: initialization throws (PostHog and Auth never called)
    await expect(configureTestBed()).rejects.toThrow(
      'Failed to fetch config.json',
    );
    expect(mockPostHog.initialize).not.toHaveBeenCalled();
    expect(mockAuthSession.initializeAuthState).not.toHaveBeenCalled();
  });

  it('should not initialize analytics if PostHog fails in production', async () => {
    // GIVEN: PostHog fails in production
    mockPostHog.initialize.mockRejectedValue(new Error('PostHog down'));
    mockConfig.isDevelopment.mockReturnValue(false);

    // WHEN: app initializes
    await configureTestBed();

    // THEN: analytics tracking was NOT initialized
    expect(mockAnalytics.initializeAnalyticsTracking).not.toHaveBeenCalled();
  });
});
