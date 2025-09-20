import {
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import posthog, { type Properties, type CaptureResult } from 'posthog-js';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { buildInfo } from '@env/build-info';

const POSTHOG_SENSITIVE_PROPERTY_KEYS = new Set(
  [
    'amount',
    'balance',
    'available_amount',
    'availableamount',
    'planned_amount',
    'plannedamount',
    'budget_amount',
    'budgetamount',
    'total',
    'income',
    'expense',
    'expenses',
    'saving',
    'savings',
  ].map((key) => key.toLowerCase()),
);

const POSTHOG_SECRET_KEYWORDS = [
  'password',
  'secret',
  'token',
  'key',
  'auth',
  'credential',
];

const POSTHOG_SENSITIVE_QUERY_PARAMS = new Set(
  ['budgetId', 'transactionId', 'templateId', 'token'].map((param) =>
    param.toLowerCase(),
  ),
);

const DYNAMIC_SEGMENT_REPLACERS: readonly [RegExp, string][] = [
  [/\/budgets?\/[a-zA-Z0-9-]+/gi, '/budget/[id]'],
  [/\/transactions?\/[a-zA-Z0-9-]+/gi, '/transaction/[id]'],
  [/\/templates?\/[a-zA-Z0-9-]+/gi, '/template/[id]'],
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]';

const sanitizeUrl = (url: string): string => {
  if (typeof url !== 'string') return url;

  const applyDynamicSegmentReplacements = (pathname: string): string =>
    DYNAMIC_SEGMENT_REPLACERS.reduce(
      (result, [pattern, replacement]) => result.replace(pattern, replacement),
      pathname,
    );

  try {
    const isAbsolute = /^[a-zA-Z][\w+.-]*:/.test(url);
    const base = isAbsolute
      ? undefined
      : typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost';
    const parsed = new URL(url, base);

    const sanitizedParams = new URLSearchParams(parsed.searchParams);
    for (const key of Array.from(sanitizedParams.keys())) {
      if (POSTHOG_SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        sanitizedParams.delete(key);
      }
    }

    const sanitizedPath = applyDynamicSegmentReplacements(parsed.pathname);
    const search = sanitizedParams.toString();
    const hash = parsed.hash;

    if (isAbsolute) {
      return `${parsed.protocol}//${parsed.host}${sanitizedPath}${search ? `?${search}` : ''}${hash}`;
    }

    return `${sanitizedPath}${search ? `?${search}` : ''}${hash}`;
  } catch {
    return applyDynamicSegmentReplacements(url);
  }
};

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (isPlainObject(value)) {
    return sanitizeObject(value);
  }

  return value;
}

function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  if (!isPlainObject(obj)) return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = key.toLowerCase();

    if (POSTHOG_SENSITIVE_PROPERTY_KEYS.has(normalizedKey)) {
      continue;
    }

    if (
      POSTHOG_SECRET_KEYWORDS.some((keyword) => normalizedKey.includes(keyword))
    ) {
      continue;
    }

    if (normalizedKey.includes('url') || normalizedKey.includes('href')) {
      result[key] = typeof value === 'string' ? sanitizeUrl(value) : value;
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = sanitizeValue(value);
      continue;
    }

    if (isPlainObject(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
      continue;
    }

    result[key] = value;
  }

  return result as T;
}

/**
 * PostHog service for analytics and error tracking.
 * Uses PostHog's built-in privacy protection and minimal configuration.
 */
@Injectable({
  providedIn: 'root',
})
export class PostHogService {
  readonly #applicationConfiguration = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);
  readonly #platformId = inject(PLATFORM_ID);

  readonly #isInitialized = signal<boolean>(false);

  readonly isInitialized = this.#isInitialized.asReadonly();
  readonly isEnabled = computed(() => {
    const config = this.#applicationConfiguration.postHogConfig();
    return config?.enabled ?? false;
  });

  /**
   * Initialize PostHog with minimal configuration.
   * Leverages PostHog's built-in privacy defaults.
   */
  async initialize(): Promise<void> {
    if (!isPlatformBrowser(this.#platformId)) {
      this.#logger.debug('PostHog initialization skipped - not in browser');
      return;
    }

    const config = this.#applicationConfiguration.postHogConfig();

    if (!config?.enabled || !config.apiKey) {
      this.#logger.info('PostHog configuration disabled or missing API key');
      return;
    }

    try {
      this.#logger.info('Initializing PostHog', { host: config.host });

      posthog.init(config.apiKey, {
        api_host: config.host,
        debug: config.debug,

        // Privacy-first configuration
        capture_pageview: false, // Enable after user consent
        capture_pageleave: false,
        opt_out_capturing_by_default: true,

        // Session recording with built-in privacy
        session_recording: {
          maskAllInputs: true, // PostHog handles financial data masking
          recordCrossOriginIframes: false,
        },
        disable_session_recording: !config.sessionRecording?.enabled,

        // Built-in privacy protection
        person_profiles: 'identified_only',
        persistence: 'localStorage+cookie',

        // Sanitize financial data before sending
        before_send: this.#sanitizeEvent.bind(this),

        loaded: () => {
          this.#registerGlobalProperties();
          this.#isInitialized.set(true);
          this.#logger.info('PostHog initialized successfully');
        },
      });
    } catch (error) {
      this.#logger.error('Failed to initialize PostHog', error);
    }
  }

  /**
   * Enable tracking after user consent
   */
  enableTracking(): void {
    if (!this.canCapture()) return;

    try {
      posthog.opt_in_capturing();

      // Enable automatic pageview and pageleave tracking for web analytics
      posthog.set_config({
        capture_pageview: true,
        capture_pageleave: true,
      });

      // Capture the initial pageview
      posthog.capture('$pageview');
      this.#logger.info('PostHog tracking enabled with web analytics');
    } catch (error) {
      this.#logger.error('Failed to enable tracking', error);
    }
  }

  /**
   * Capture exception using official PostHog method
   * PostHog automatically handles: timestamp, url, stack traces, fingerprinting, grouping
   */
  captureException(error: unknown, context?: Properties): void {
    if (!this.canCapture()) return;

    try {
      posthog.captureException(error, {
        ...context,
        release: buildInfo.version,
        commit: buildInfo.shortCommitHash,
      });

      this.#logger.debug('PostHog exception captured');
    } catch (captureError) {
      this.#logger.error('Failed to capture exception', captureError);
    }
  }

  /**
   * Identify user
   */
  identify(userId: string, properties?: Properties): void {
    if (!this.canCapture()) return;

    try {
      posthog.identify(userId, properties);
      this.#logger.debug('PostHog user identified', { userId });
    } catch (error) {
      this.#logger.error('Failed to identify user', error);
    }
  }

  /**
   * Set person properties (modern method)
   */
  setPersonProperties(
    properties?: Properties,
    propertiesOnce?: Properties,
  ): void {
    if (!this.canCapture()) return;

    try {
      posthog.setPersonProperties(properties, propertiesOnce);
      this.#logger.debug('PostHog person properties set');
    } catch (error) {
      this.#logger.error('Failed to set person properties', error);
    }
  }

  /**
   * Reset state (e.g., on logout)
   */
  reset(): void {
    if (!this.canCapture()) return;

    try {
      posthog.reset();
      this.#logger.debug('PostHog state reset');
    } catch (error) {
      this.#logger.error('Failed to reset PostHog', error);
    }
  }

  canCapture(): boolean {
    return (
      isPlatformBrowser(this.#platformId) &&
      this.#isInitialized() &&
      this.isEnabled()
    );
  }

  #registerGlobalProperties(): void {
    try {
      const globalProperties = {
        environment: this.#applicationConfiguration.environment(),
        app_version: buildInfo.version,
        app_commit: buildInfo.shortCommitHash,
        platform: 'web',
      };

      posthog.register(globalProperties);
      this.#logger.info('PostHog global properties registered');

      // Use modern setPersonProperties instead of deprecated people.set_once
      this.setPersonProperties(undefined, {
        first_app_version: buildInfo.version,
        first_commit: buildInfo.shortCommitHash,
      });
    } catch (error) {
      this.#logger.error('Failed to register global properties', error);
    }
  }

  /**
   * Sanitize events to protect financial data
   */
  #sanitizeEvent(event: CaptureResult | null): CaptureResult | null {
    if (!event) return null;

    try {
      if (event.properties) {
        const currentUrl = event.properties['$current_url'];
        if (typeof currentUrl === 'string') {
          event.properties['$current_url'] = sanitizeUrl(currentUrl);
        }

        event.properties = sanitizeObject(
          event.properties as Record<string, unknown>,
        ) as Properties;
      }

      if (event.$set) {
        event.$set = sanitizeObject(
          event.$set as Record<string, unknown>,
        ) as Properties;
      }

      if (event.$set_once) {
        event.$set_once = sanitizeObject(
          event.$set_once as Record<string, unknown>,
        ) as Properties;
      }

      return event;
    } catch (error) {
      this.#logger.error('Error sanitizing event', error);
      // Return event as-is if sanitization fails to avoid data loss
      return event;
    }
  }
}
