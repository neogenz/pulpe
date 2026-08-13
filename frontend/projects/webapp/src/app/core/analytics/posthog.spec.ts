import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  signal,
  computed,
} from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
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
let routerEvents: Subject<NavigationEnd>;
let routerNavigated = true;

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
    routerEvents = new Subject<NavigationEnd>();
    routerNavigated = true;
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
        {
          provide: Router,
          useValue: {
            events: routerEvents,
            get navigated() {
              return routerNavigated;
            },
          },
        },
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
        mask_all_text: true,
        mask_all_element_attributes: true,
        rageclick: false,
        capture_heatmaps: false,
        capture_dead_clicks: false,
        enable_recording_console_log: false,
        save_campaign_params: false,
        save_referrer: false,
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

  it('applies the configured session replay sample rate', async () => {
    postHogSignal.set({
      ...defaultConfig,
      sessionRecording: {
        ...defaultConfig.sessionRecording,
        sampleRate: 0.1,
      },
    });

    await service.initialize();

    expect(initializationOptions).toEqual(
      expect.objectContaining({
        session_recording: expect.objectContaining({
          sampleRate: 0.1,
        }),
      }),
    );
  });

  it('keeps session replay request bodies and headers disabled', async () => {
    await service.initialize();

    expect(initializationOptions).toEqual(
      expect.objectContaining({
        session_recording: expect.objectContaining({
          recordBody: false,
          recordHeaders: false,
        }),
      }),
    );
  });

  it('blocks URL-bearing DOM nodes and styles from session replay', async () => {
    await service.initialize();

    const sessionRecording = initializationOptions?.[
      'session_recording'
    ] as Record<string, unknown>;
    const blockSelector = sessionRecording['blockSelector'];

    expect(blockSelector).toEqual(expect.any(String));
    expect(blockSelector).toContain('[href]');
    expect(blockSelector).toContain('[src]');
    expect(blockSelector).toContain('[srcset]');
    expect(blockSelector).toContain('[action]');
    expect(blockSelector).toContain('[style]');
    expect(blockSelector).toContain('style');
    expect(blockSelector).toContain('link');
    expect(sessionRecording['maskTextSelector']).toBe('*');
    expect(sessionRecording['inlineStylesheet']).toBe(false);
    expect(sessionRecording['compress_events']).toBe(false);
    expect(() =>
      document.querySelectorAll(blockSelector as string),
    ).not.toThrow();
  });

  it('sanitizes replay URLs and drops payload fields defensively', async () => {
    await service.initialize();

    const sessionRecording = initializationOptions?.[
      'session_recording'
    ] as Record<string, unknown>;
    const sanitizeCapturedUrl = sessionRecording[
      'maskCapturedNetworkRequestFn'
    ] as (request: Record<string, unknown>) => Record<string, unknown>;

    const sanitized = sanitizeCapturedUrl({
      name: 'https://app.local/budgets/123?token=private&safe=1#access_token=private',
      requestHeaders: { authorization: 'private' },
      responseHeaders: { 'set-cookie': 'private' },
      requestBody: 'private request',
      responseBody: 'private response',
      status: 200,
    });

    expect(sanitized['name']).toBe('https://app.local/budgets/[id]');
    expect(sanitized['status']).toBe(200);
    expect(sanitized).not.toHaveProperty('requestHeaders');
    expect(sanitized).not.toHaveProperty('responseHeaders');
    expect(sanitized).not.toHaveProperty('requestBody');
    expect(sanitized).not.toHaveProperty('responseBody');
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
      capture_pageview: false,
      capture_pageleave: true,
      // Native PostHog autocapture can ingest data-ph-capture attributes before
      // before_send. Pulpe emits the same event through its pre-sanitized listener.
      autocapture: false,
    });
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
  });

  it('waits for the initial NavigationEnd before capturing a cold-start pageview', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    routerNavigated = false;

    await service.initialize();
    service.enableTracking();

    expect(posthog.capture).not.toHaveBeenCalledWith('$pageview');

    routerNavigated = true;
    routerEvents.next(
      new NavigationEnd(1, '/budgets/example-id', '/budgets/example-id'),
    );

    expect(posthog.capture).toHaveBeenCalledOnce();
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
  });

  it('captures each completed Angular navigation after tracking starts', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();
    service.enableTracking();
    vi.mocked(posthog.capture).mockClear();

    routerEvents.next(
      new NavigationEnd(1, '/budgets/example-id', '/budgets/example-id'),
    );

    expect(posthog.capture).toHaveBeenCalledOnce();
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
  });

  it('automatically captures clicks with structure only before invoking PostHog', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    const wrapper = document.createElement('section');
    const button = document.createElement('button');
    wrapper.id = 'example-budget-id';
    wrapper.className = 'private-css-class';
    button.textContent = 'Private budget label';
    button.setAttribute(
      'data-ph-capture-attribute-private-context',
      'private-augmented-value',
    );
    wrapper.append(button);
    document.body.append(wrapper);
    const wrapperNthChild =
      Array.from(document.body.children).indexOf(wrapper) + 1;

    try {
      await service.initialize();
      service.enableTracking();
      vi.mocked(posthog.capture).mockClear();

      button.click();

      expect(posthog.capture).toHaveBeenCalledTimes(1);
      expect(posthog.capture).toHaveBeenCalledWith('$autocapture', {
        $event_type: 'click',
        $ce_version: 1,
        $elements: [
          { tag_name: 'button', nth_child: 1, nth_of_type: 1 },
          {
            tag_name: 'section',
            nth_child: wrapperNthChild,
            nth_of_type: 1,
          },
        ],
        $elements_chain: `button:nth-child="1"nth-of-type="1";section:nth-child="${wrapperNthChild}"nth-of-type="1"`,
      });
      const serializedCall = JSON.stringify(
        vi.mocked(posthog.capture).mock.calls[0],
      );
      expect(serializedCall).not.toContain('example-budget-id');
      expect(serializedCall).not.toContain('private-css-class');
      expect(serializedCall).not.toContain('Private budget label');
      expect(serializedCall).not.toContain('private-augmented-value');
      expect(serializedCall).not.toContain('private-context');
    } finally {
      wrapper.remove();
    }
  });

  it('does not autocapture clicks inside ph-no-capture regions', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    const wrapper = document.createElement('div');
    const button = document.createElement('button');
    wrapper.className = 'ph-no-capture';
    wrapper.append(button);
    document.body.append(wrapper);

    try {
      await service.initialize();
      service.enableTracking();
      vi.mocked(posthog.capture).mockClear();

      button.click();

      expect(posthog.capture).not.toHaveBeenCalled();
    } finally {
      wrapper.remove();
    }
  });

  it('stops sanitized autocapture immediately when diagnostic sharing is disabled', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    const button = document.createElement('button');
    document.body.append(button);

    try {
      await service.initialize();
      service.enableTracking();
      vi.mocked(posthog.set_config).mockClear();
      vi.mocked(posthog.capture).mockClear();

      service.setDiagnosticSharingEnabled(false);
      button.click();

      expect(posthog.set_config).toHaveBeenCalledWith({
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,
      });
      expect(posthog.capture).not.toHaveBeenCalled();
    } finally {
      button.remove();
    }
  });

  it('stops sanitized autocapture when PostHog state is reset', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    const button = document.createElement('button');
    document.body.append(button);

    try {
      await service.initialize();
      service.enableTracking();
      vi.mocked(posthog.capture).mockClear();

      service.reset();
      button.click();

      expect(posthog.capture).not.toHaveBeenCalled();
    } finally {
      button.remove();
    }
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

  it('sanitizes identify properties before they enter PostHog SDK state', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();

    service.identify('user-example', {
      email: 'person@example.test',
      name: 'First',
      supabase_user_id: 'technical-user-id',
      currency: 'EUR',
      early_adopter: true,
      planned_amount: 1200,
      budget_id: 'private-budget-id',
      authToken: 'private-token',
    });

    expect(posthog.identify).toHaveBeenCalledWith('user-example', {
      email: 'person@example.test',
      name: 'First',
      supabase_user_id: 'technical-user-id',
      currency: 'EUR',
      early_adopter: true,
    });
  });

  it('rejects non-string identity properties before SDK state mutation', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();

    service.identify('user-example', {
      email: { authToken: 'private-token' },
      name: ['private-name'],
      supabase_user_id: { budget_id: 'private-budget-id' },
      currency: 'EUR',
    });

    expect(posthog.identify).toHaveBeenCalledWith('user-example', {
      currency: 'EUR',
    });
  });

  it('sanitizes person property updates before they enter PostHog SDK state', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();
    vi.mocked(posthog.setPersonProperties).mockClear();

    service.setPersonProperties(
      {
        currency: 'EUR',
        show_currency_selector: true,
        balance: 4200,
        goal_id: 'private-goal-id',
        password: 'private-password',
      },
      {
        first_app_version: '1.2.3',
        signup_amount: 500,
        initial_budget_id: 'private-budget-id',
      },
    );

    expect(posthog.setPersonProperties).toHaveBeenCalledWith(
      {
        currency: 'EUR',
        show_currency_selector: true,
      },
      {
        first_app_version: '1.2.3',
      },
    );
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

  it('drops event person mutations before they enter PostHog SDK state', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();
    service.captureEvent(ANALYTICS_EVENTS.BUDGET_CREATED, {
      feature: 'budget',
      $set: {
        email: 'private@example.test',
        balance: 4200,
      },
      $set_once: {
        initial_budget_id: 'private-budget-id',
      },
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

  it('starts requested tracking after opting in from an initially disabled state', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    optedOut = true;
    await service.initialize();

    service.enableTracking();
    service.setDiagnosticSharingEnabled(true);
    vi.mocked(posthog.capture).mockClear();

    routerEvents.next(new NavigationEnd(2, '/settings', '/settings'));

    expect(posthog.capture).toHaveBeenCalledOnce();
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
  });

  it('restores exactly one click and navigation collector after opt-out then opt-in', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    const button = document.createElement('button');
    document.body.append(button);

    try {
      await service.initialize();
      service.enableTracking();
      service.setDiagnosticSharingEnabled(false);
      service.setDiagnosticSharingEnabled(true);
      vi.mocked(posthog.capture).mockClear();

      button.click();
      routerEvents.next(new NavigationEnd(2, '/settings', '/settings'));

      expect(posthog.capture).toHaveBeenCalledTimes(2);
      expect(posthog.capture).toHaveBeenCalledWith(
        '$autocapture',
        expect.any(Object),
      );
      expect(posthog.capture).toHaveBeenCalledWith('$pageview');
    } finally {
      button.remove();
    }
  });

  it('sanitizes exception context before it can mutate PostHog SDK state', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    await service.initialize();

    service.captureException(new Error('technical failure'), {
      httpStatus: 500,
      backendErrorCode: 'BUDGET_LOAD_FAILED',
      request_id: 'request-123',
      budget_id: 'private-budget-id',
      planned_amount: 4200,
      $set: { email: 'private@example.test' },
      $set_once: { initial_budget_id: 'private-budget-id' },
    });

    expect(posthog.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        httpStatus: 500,
        backendErrorCode: 'BUDGET_LOAD_FAILED',
        request_id: 'request-123',
        release: expect.any(String),
        commit: expect.any(String),
      }),
    );
    const context = vi.mocked(posthog.captureException).mock.calls[0]?.[1];
    expect(context).not.toHaveProperty('budget_id');
    expect(context).not.toHaveProperty('planned_amount');
    expect(context).not.toHaveProperty('$set');
    expect(context).not.toHaveProperty('$set_once');
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
      url: 'https://app.test/budgets/[id]',
    });
    expect(result?.properties?.['$current_url']).toBe(
      'https://app.test/transactions/[id]',
    );
    expect(result?.$set?.['expense']).toBeUndefined();
    expect(result?.$set_once?.['income']).toBeUndefined();
  });

  it('drops non-JSON property objects before PostHog transport serialization', async () => {
    await service.initialize();

    const eventDate = new Date('2025-01-01T00:00:00.000Z');
    const rawEvent = {
      properties: {
        timestamp: eventDate,
        meta: new Map([['private-key', 'private-value']]),
        info: {
          date: eventDate,
          safe_state: 'completed',
        },
      },
    } as unknown as CaptureResult;

    const result = beforeSendHandler?.(rawEvent);

    expect(result?.properties?.['timestamp']).toBeUndefined();
    expect(result?.properties?.['meta']).toBeUndefined();
    expect(result?.properties?.['info']).toEqual({ safe_state: 'completed' });
    expect(JSON.stringify(result)).not.toContain('private-key');
    expect(JSON.stringify(result)).not.toContain('private-value');
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

describe('PostHogService — Angular Router bootstrap', () => {
  it('captures exactly one pageview after the initial deep navigation resolves', async () => {
    vi.clearAllMocks();
    optedOut = false;
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;
    const config = {
      apiKey: 'test-api-key',
      host: 'https://posthog.test',
      enabled: true,
      capturePageviews: true,
      capturePageleaves: true,
      sessionRecording: {
        enabled: true,
        maskInputs: true,
        sampleRate: 0.1,
      },
      debug: false,
    };
    const postHogSignal = signal(config);
    const isDevelopmentSignal = signal(false);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'budgets/:id', children: [] }]),
        PostHogService,
        {
          provide: ApplicationConfiguration,
          useValue: {
            postHog: postHogSignal,
            environment: signal('test'),
            supabaseUrl: signal('https://test.supabase.co'),
            supabaseAnonKey: signal('test-key'),
            isDevelopment: isDevelopmentSignal,
            postHogConfig: computed(() => ({
              ...postHogSignal(),
              debug: postHogSignal().debug || isDevelopmentSignal(),
            })),
          },
        },
        { provide: Logger, useValue: createMockLogger() },
        {
          provide: StorageService,
          useValue: {
            get: vi.fn(() => null),
            getString: vi.fn(() => null),
            setString: vi.fn(),
            remove: vi.fn(),
          },
        },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = TestBed.inject(PostHogService);
    const router = TestBed.inject(Router);

    await service.initialize();
    service.enableTracking();

    expect(router.navigated).toBe(false);
    expect(posthog.capture).not.toHaveBeenCalledWith('$pageview');

    await router.navigateByUrl('/budgets/example-id');

    expect(posthog.capture).toHaveBeenCalledOnce();
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
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
