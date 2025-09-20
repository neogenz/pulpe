import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  signal,
  computed,
} from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import type { CaptureResult } from 'posthog-js';
import { PostHogService } from './posthog';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { createMockLogger } from '../../testing/mock-posthog';

let beforeSendHandler:
  | ((event: CaptureResult | null) => CaptureResult | null)
  | undefined;

vi.mock('posthog-js', () => {
  return {
    default: {
      init: vi.fn((_apiKey, options) => {
        beforeSendHandler = options?.before_send;
        if (options?.loaded) {
          options.loaded();
        }
      }),
      opt_in_capturing: vi.fn(),
      capture: vi.fn(),
      captureException: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
      register: vi.fn(),
      set_config: vi.fn(),
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
  } as const;

  beforeEach(async () => {
    vi.clearAllMocks();
    beforeSendHandler = undefined;

    const posthogModule = await import('posthog-js');
    vi.mocked(posthogModule.default.set_config).mockClear();

    const postHogSignal = signal({ ...defaultConfig });
    const isDevelopmentSignal = signal(false);

    const mockAppConfig = {
      postHog: postHogSignal,
      environment: signal('test'),
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
        opt_out_capturing_by_default: true,
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

  it('enables tracking and records initial pageview after consent', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();
    service.enableTracking();

    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1);
    expect(posthog.set_config).toHaveBeenCalledWith({
      capture_pageleave: true,
      capture_pageview: true,
    });
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
  });

  it('identifies the user when analytics is active', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();
    expect(service.canCapture()).toBe(true);

    service.identify('user-123', { plan: 'pro' });

    expect(posthog.identify).toHaveBeenCalledWith('user-123', { plan: 'pro' });
  });

  it('resets PostHog state', async () => {
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    await service.initialize();
    service.reset();

    expect(posthog.reset).toHaveBeenCalledTimes(1);
  });

  it('sanitizes sensitive fields and URLs before sending events', async () => {
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
});
