import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  signal,
  computed,
} from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import type { CaptureResult } from 'posthog-js';
import { ANALYTICS_EVENTS } from 'pulpe-shared';
import { PostHogService } from './posthog';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { createMockLogger } from '../../testing/mock-posthog';

let beforeSendHandler:
  | ((event: CaptureResult | null) => CaptureResult | null)
  | undefined;
let optedOut = false;
let initializationOptions: Record<string, unknown> | undefined;
let legacyCookiePresentAtInit = false;

vi.mock('posthog-js', () => {
  return {
    default: {
      init: vi.fn((_apiKey, options) => {
        initializationOptions = options;
        legacyCookiePresentAtInit = document.cookie.includes(
          'ph_test-api-key_posthog=',
        );
        beforeSendHandler = options?.before_send;
        if (options?.loaded) {
          options.loaded();
        }
      }),
      has_opted_out_capturing: vi.fn(() => optedOut),
      opt_in_capturing: vi.fn(() => {
        optedOut = false;
      }),
      opt_out_capturing: vi.fn(() => {
        optedOut = true;
      }),
      startSessionRecording: vi.fn(),
      stopSessionRecording: vi.fn(),
      capture: vi.fn(),
      captureException: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
      register: vi.fn(),
      set_config: vi.fn(),
      onFeatureFlags: vi.fn(),
      isFeatureEnabled: vi.fn(() => false),
      setPersonProperties: vi.fn(),
    },
  };
});

describe('PostHogService', () => {
  let service: PostHogService;
  const defaultConfig = {
    apiKey: 'test-api-key',
    host: 'https://posthog.test',
    enabled: true,
    capturePageviews: true,
    capturePageleaves: true,
    sessionRecording: {
      enabled: true,
      maskInputs: true,
      sampleRate: 1.0,
    },
    debug: false,
  };
  let postHogSignal: ReturnType<typeof signal<typeof defaultConfig>>;
  let environmentSignal: ReturnType<typeof signal<string>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    beforeSendHandler = undefined;
    optedOut = false;
    initializationOptions = undefined;
    legacyCookiePresentAtInit = false;
    document.cookie =
      'ph_test-api-key_posthog=; Max-Age=0; Path=/; SameSite=Lax';

    const posthogModule = await import('posthog-js');
    vi.mocked(posthogModule.default.set_config).mockClear();

    postHogSignal = signal({ ...defaultConfig });
    const isDevelopmentSignal = signal(false);
    environmentSignal = signal('test');

    const mockAppConfig = {
      postHog: postHogSignal,
      environment: environmentSignal,
      supabaseUrl: signal('https://test.supabase.co'),
      supabaseAnonKey: signal('test-key'),
      isDevelopment: isDevelopmentSignal,
      postHogConfig: computed(() => {
        const config = postHogSignal();
        if (!config.apiKey) {
          return null;
        }
        return {
          ...config,
          debug: config.debug || isDevelopmentSignal(),
        };
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        PostHogService,
        { provide: ApplicationConfiguration, useValue: mockAppConfig },
        { provide: Logger, useValue: createMockLogger() },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(PostHogService);
  });

  it('initializes PostHog with privacy-first defaults', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();

    expect(posthog.init).toHaveBeenCalledWith(
      defaultConfig.apiKey,
      expect.objectContaining({
        api_host: defaultConfig.host,
        capture_pageview: false,
        autocapture: false,
      }),
    );
    expect(service.isInitialized()).toBe(true);
    expect(posthog.register).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'test',
        platform: 'web',
      }),
    );
  });

  it('isolates app persistence and removes the legacy shared identity before init', async () => {
    document.cookie =
      'ph_test-api-key_posthog=legacy-identity; Path=/; SameSite=Lax';
    localStorage.setItem('__ph_opt_in_out_test-api-key', '0');

    await service.initialize();

    expect(legacyCookiePresentAtInit).toBe(false);
    expect(initializationOptions).toEqual(
      expect.objectContaining({
        persistence_name: 'pulpe_app',
        cross_subdomain_cookie: false,
      }),
    );
    expect(localStorage.getItem('__ph_opt_in_out_test-api-key')).toBe('0');
  });

  it('enables tracking and records initial pageview after consent', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();
    service.enableTracking();

    expect(posthog.set_config).toHaveBeenCalledWith({
      capture_pageview: 'history_change',
      capture_pageleave: 'if_capture_pageview',
      autocapture: true,
    });
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
  });

  it('keeps configured session replay enabled in production', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    environmentSignal.set('production');

    await service.initialize();

    expect(posthog.init).toHaveBeenCalledWith(
      defaultConfig.apiKey,
      expect.objectContaining({ disable_session_recording: false }),
    );
  });

  it.each(['local', 'preview', 'production'])(
    'keeps session replay disabled by configuration in %s',
    async (environment) => {
      const posthogModule = await import('posthog-js');
      const posthog = posthogModule.default;
      environmentSignal.set(environment);
      postHogSignal.set({
        ...defaultConfig,
        sessionRecording: {
          ...defaultConfig.sessionRecording,
          enabled: false,
        },
      });

      await service.initialize();

      expect(posthog.init).toHaveBeenCalledWith(
        defaultConfig.apiKey,
        expect.objectContaining({ disable_session_recording: true }),
      );
    },
  );

  it('identifies the user when analytics is active', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();

    service.identify('user-123', { plan: 'pro' });

    expect(posthog.identify).toHaveBeenCalledWith('user-123', { plan: 'pro' });
  });

  it('does not capture events before initialization', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    service.captureEvent(ANALYTICS_EVENTS.APP_OPENED);

    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('captures events after initialization', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();
    service.captureEvent(ANALYTICS_EVENTS.BUDGET_CREATED, {
      feature: 'budget',
    });

    expect(posthog.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.BUDGET_CREATED,
      {
        feature: 'budget',
      },
    );
  });

  it('opts out immediately, clears identity, and preserves the local choice', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    await service.initialize();

    service.setDiagnosticSharingEnabled(false);
    service.captureEvent(ANALYTICS_EVENTS.TAB_SWITCHED);

    expect(posthog.stopSessionRecording).toHaveBeenCalledTimes(1);
    expect(posthog.reset).toHaveBeenCalledWith(true);
    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
    expect(service.diagnosticSharingEnabled()).toBe(false);
    expect(posthog.capture).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.TAB_SWITCHED,
    );
  });

  it('opts back in without emitting a consent event', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    optedOut = true;
    await service.initialize();

    service.setDiagnosticSharingEnabled(true);

    expect(posthog.opt_in_capturing).toHaveBeenCalledWith({
      captureEventName: false,
    });
    expect(posthog.startSessionRecording).toHaveBeenCalledTimes(1);
    expect(service.diagnosticSharingEnabled()).toBe(true);
  });

  it('never restarts session replay when it is disabled by configuration', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    optedOut = true;
    environmentSignal.set('production');
    postHogSignal.set({
      ...defaultConfig,
      sessionRecording: {
        ...defaultConfig.sessionRecording,
        enabled: false,
      },
    });
    await service.initialize();

    service.setDiagnosticSharingEnabled(true);

    expect(posthog.startSessionRecording).not.toHaveBeenCalled();
  });

  it('resets PostHog state', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();
    service.reset();

    expect(posthog.reset).toHaveBeenCalledTimes(1);
  });

  it('sanitizes financial fields and URLs while keeping custom metadata', async () => {
    await service.initialize();
    expect(beforeSendHandler).toBeDefined();

    const rawEvent = {
      properties: {
        amount: 1250,
        balance: 4200,
        password: 'super-secret',
        authToken: 'token-value',
        nested: {
          savings: 999,
          url: 'https://app.test/budgets/abc-123?transactionId=tx-456&safe=true',
        },
        $current_url:
          'https://app.test/transactions/tx-789?templateId=temp-321#details',
      },
      $set: {
        expense: 300,
      },
      $set_once: {
        income: 5000,
      },
    } as unknown as CaptureResult;

    const result = beforeSendHandler?.(rawEvent);

    expect(result?.properties?.['amount']).toBeUndefined();
    expect(result?.properties?.['balance']).toBeUndefined();
    expect(result?.properties?.['password']).toBeUndefined();
    expect(result?.properties?.['authToken']).toBeUndefined();
    expect(result?.properties?.['nested']).toEqual({
      url: 'https://app.test/budget/[id]?safe=true',
    });
    expect(result?.properties?.['$current_url']).toBe(
      'https://app.test/transaction/[id]#details',
    );
    expect(result?.$set?.['expense']).toBeUndefined();
    expect(result?.$set_once?.['income']).toBeUndefined();
  });

  it('preserves non-plain objects when sanitizing', async () => {
    await service.initialize();

    const eventDate = new Date('2025-01-01T00:00:00.000Z');
    const rawEvent = {
      properties: {
        timestamp: eventDate,
        meta: new Map([['key', 'value']]),
        info: {
          date: eventDate,
        },
      },
    } as unknown as CaptureResult;

    const result = beforeSendHandler?.(rawEvent);

    expect(result?.properties?.['timestamp']).toBe(eventDate);
    expect(result?.properties?.['meta']).toBeInstanceOf(Map);
    expect(result?.properties?.['info']).toEqual({ date: eventDate });
  });

  it('preserves only PostHog SDK token fields', async () => {
    await service.initialize();

    const rawEvent = {
      token: defaultConfig.apiKey,
      api_key: defaultConfig.apiKey,
      properties: {
        token: defaultConfig.apiKey,
        api_key: defaultConfig.apiKey,
        authToken: 'should-be-removed',
      },
    } as unknown as CaptureResult;

    const result = beforeSendHandler?.(rawEvent);
    type TokenizedCaptureResult = CaptureResult & {
      token?: string;
      api_key?: string;
    };
    const payload = result as TokenizedCaptureResult | null;

    expect(payload?.token).toBe(defaultConfig.apiKey);
    expect(payload?.api_key).toBe(defaultConfig.apiKey);
    expect(payload?.properties?.['token']).toBe(defaultConfig.apiKey);
    expect(payload?.properties?.['api_key']).toBe(defaultConfig.apiKey);
    expect(payload?.properties?.['authToken']).toBeUndefined();
  });

  it('keeps PostHog system fields and strips token-like custom properties', async () => {
    await service.initialize();

    const rawEvent = {
      properties: {
        distinct_id: 'uid-123',
        $lib: 'posthog-js',
        $lib_version: '1.260.2',
        authToken: 'should-be-stripped',
      },
    } as unknown as CaptureResult;

    const result = beforeSendHandler?.(rawEvent);

    expect(result?.properties?.['distinct_id']).toBe('uid-123');
    expect(result?.properties?.['$lib']).toBe('posthog-js');
    expect(result?.properties?.['$lib_version']).toBe('1.260.2');
    expect(result?.properties?.['authToken']).toBeUndefined();
  });
});

describe('PostHogService — dev feature-flag override', () => {
  const EXAMPLE_FLAG = 'example-flag';
  let environment: ReturnType<typeof signal<string>>;
  let devFlags: Record<string, boolean> | null;

  beforeEach(() => {
    vi.clearAllMocks();
    environment = signal<string>('local');
    devFlags = null;

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        PostHogService,
        {
          provide: ApplicationConfiguration,
          useValue: { environment, postHogConfig: computed(() => null) },
        },
        { provide: Logger, useValue: createMockLogger() },
        {
          provide: StorageService,
          useValue: {
            get: vi.fn((key: string) =>
              key === STORAGE_KEYS.DEV_FEATURE_FLAGS ? devFlags : null,
            ),
          },
        },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
  });

  it('enables a flag from the localStorage override in a dev environment', () => {
    devFlags = { [EXAMPLE_FLAG]: true };

    const service = TestBed.inject(PostHogService);

    expect(service.isFeatureEnabled(EXAMPLE_FLAG)).toBe(true);
  });

  it('ignores the localStorage override in production', () => {
    environment.set('production');
    devFlags = { [EXAMPLE_FLAG]: true };

    const service = TestBed.inject(PostHogService);

    expect(service.isFeatureEnabled(EXAMPLE_FLAG)).toBe(false);
  });
});
