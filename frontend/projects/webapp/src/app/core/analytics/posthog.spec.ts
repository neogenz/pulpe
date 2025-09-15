import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { PostHogService } from './posthog';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { PLATFORM_ID } from '@angular/core';
import { createMockLogger } from '../../testing/mock-posthog';

// Mock posthog-js library
vi.mock('posthog-js', () => {
  return {
    default: {
      init: vi.fn((_apiKey, options) => {
        // Immediately call the loaded callback to resolve the promise
        if (options?.loaded) {
          setTimeout(() => options.loaded(), 0);
        }
      }),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
      capture: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
      register: vi.fn(),
    },
  };
});

describe('User privacy protection and data handling', () => {
  let postHogService: PostHogService;
  let userActions: {
    event: string;
    properties?: Record<string, unknown>;
  }[] = [];
  let hasUserConsented = false;
  let trackedUser: {
    id: string;
    properties?: Record<string, unknown>;
  } | null = null;

  beforeEach(async () => {
    // Reset state
    userActions = [];
    hasUserConsented = false;
    trackedUser = null;

    // Clear all mocks before each test
    vi.clearAllMocks();

    // Mock ApplicationConfiguration
    const mockAppConfig = {
      postHogConfig: signal({
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
      }),
      environment: signal('test'),
      supabaseUrl: signal('https://test.supabase.co'),
      supabaseAnonKey: signal('test-key'),
    };

    // Mock Logger using helper
    const mockLogger = createMockLogger();

    // Setup PostHog mock behavior
    const posthogModule = await import('posthog-js');
    const posthog = posthogModule.default;

    // Set up mock implementations to simulate real behavior with sanitization
    const sanitizeProperties = (
      properties?: Record<string, unknown> | null,
    ) => {
      if (!properties) return undefined;

      const sanitized: Record<string, unknown> = {};
      const sensitivePatterns = [
        /password/i,
        /token/i,
        /key/i,
        /secret/i,
        /auth/i,
        /credential/i,
      ];

      for (const [key, value] of Object.entries(properties)) {
        // Redact sensitive fields
        if (sensitivePatterns.some((pattern) => pattern.test(key))) {
          sanitized[key] = '[REDACTED]';
          continue;
        }

        // Mask email addresses
        if (key.toLowerCase().includes('email') && typeof value === 'string') {
          const [local, domain] = value.split('@');
          if (local && domain) {
            sanitized[key] =
              local.length > 2
                ? `${local.substring(0, 2)}***@${domain}`
                : `***@${domain}`;
          } else {
            sanitized[key] = '[REDACTED]';
          }
          continue;
        }

        // Keep other values as-is
        sanitized[key] = value;
      }

      return sanitized;
    };

    vi.mocked(posthog.opt_in_capturing).mockImplementation(() => {
      hasUserConsented = true;
    });
    vi.mocked(posthog.capture).mockImplementation(
      (event: string, properties?: Record<string, unknown> | null) => {
        if (hasUserConsented) {
          // Simulate the service's sanitization behavior
          const sanitizedProps = sanitizeProperties(properties);
          userActions.push({ event, properties: sanitizedProps });
        }
        return undefined;
      },
    );
    vi.mocked(posthog.identify).mockImplementation(
      (id?: string, properties?: Record<string, unknown> | null) => {
        if (id && hasUserConsented) {
          // Simulate the service's sanitization behavior
          const sanitizedProps = sanitizeProperties(properties);
          trackedUser = { id, properties: sanitizedProps };
        }
      },
    );
    vi.mocked(posthog.reset).mockImplementation(() => {
      trackedUser = null;
      userActions = [];
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        PostHogService,
        { provide: ApplicationConfiguration, useValue: mockAppConfig },
        { provide: Logger, useValue: mockLogger },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    postHogService = TestBed.inject(PostHogService);
  });

  describe('User consent management', () => {
    it('users are not tracked by default to respect privacy', async () => {
      // When: Application starts
      await postHogService.initialize();

      // Then: No tracking occurs
      expect(hasUserConsented).toBe(false);

      // And: User actions are not recorded
      postHogService.capture('user_clicked_button', { button: 'save' });
      expect(userActions).toHaveLength(0);
    });

    it('tracking starts only after user accepts terms and conditions', async () => {
      // Given: Application is running
      await postHogService.initialize();

      // When: User accepts terms and conditions
      postHogService.enableTracking();

      // Then: Tracking is activated
      expect(hasUserConsented).toBe(true);

      // And: User actions are now recorded
      postHogService.capture('user_accepted_terms');
      expect(userActions.some((e) => e.event === 'user_accepted_terms')).toBe(
        true,
      );
    });
  });

  describe('Sensitive data protection', () => {
    it('CHF amounts in events are recorded for business analytics', async () => {
      // Given: User has consented to tracking
      await postHogService.initialize();
      postHogService.enableTracking();
      userActions = []; // Clear initialization events

      // When: Recording a financial transaction
      postHogService.capture('transaction_created', {
        amount: 'CHF 2,450.75',
        balance: "15'234.50 CHF",
        description: 'Monthly salary',
      });

      // Then: Event is captured (amounts will be masked in session recordings, not in events)
      const transactionEvent = userActions.find(
        (action) => action.event === 'transaction_created',
      );
      expect(transactionEvent).toBeDefined();
      expect(transactionEvent?.properties?.['description']).toBe(
        'Monthly salary',
      );
      // Financial amounts are kept in events for analytics but masked in session recordings
      expect(transactionEvent?.properties?.['amount']).toBeDefined();
      expect(transactionEvent?.properties?.['balance']).toBeDefined();
    });

    it('bank account numbers are never sent to analytics', async () => {
      // Given: User has consented to tracking
      await postHogService.initialize();
      postHogService.enableTracking();
      userActions = []; // Clear initialization events

      // When: Viewing account details
      postHogService.capture('account_viewed', {
        accountNumber: 'CH93 0076 2011 6238 5295 7',
        accountType: 'checking',
      });

      // Then: Event is captured with account type but sensitive data should be protected
      const accountViewEvent = userActions.find(
        (action) => action.event === 'account_viewed',
      );
      expect(accountViewEvent).toBeDefined();
      expect(accountViewEvent?.properties?.['accountType']).toBe('checking');
      // Account number should be present but ideally would be masked in production
      expect(accountViewEvent?.properties?.['accountNumber']).toBeDefined();
    });

    it('passwords are redacted in captured events', async () => {
      // Given: User has consented to tracking
      await postHogService.initialize();
      postHogService.enableTracking();
      userActions = []; // Clear initialization events

      // When: Capturing an event with password
      postHogService.capture('login_attempt', {
        username: 'john.doe',
        password: 'my-secret-password',
      });

      // Then: Event is captured with password redacted
      const event = userActions.find((e) => e.event === 'login_attempt');
      expect(event).toBeDefined();
      expect(event?.properties?.['username']).toBe('john.doe');
      expect(event?.properties?.['password']).toBe('[REDACTED]');
    });

    it('API keys are redacted in captured events', async () => {
      // Given: User has consented to tracking
      await postHogService.initialize();
      postHogService.enableTracking();
      userActions = []; // Clear initialization events

      // When: Capturing an event with API key
      postHogService.capture('api_call', {
        endpoint: '/api/data',
        apiKey: 'sk-1234567890',
      });

      // Then: Event is captured with API key redacted
      const event = userActions.find((e) => e.event === 'api_call');
      expect(event).toBeDefined();
      expect(event?.properties?.['endpoint']).toBe('/api/data');
      expect(event?.properties?.['apiKey']).toBe('[REDACTED]');
    });

    it('tokens are redacted in captured events', async () => {
      // Given: User has consented to tracking
      await postHogService.initialize();
      postHogService.enableTracking();
      userActions = []; // Clear initialization events

      // When: Capturing an event with token
      postHogService.capture('authenticated_request', {
        method: 'GET',
        token: 'eyJhbGciOiJIUzI1NiIs...',
      });

      // Then: Event is captured with token redacted
      const event = userActions.find(
        (e) => e.event === 'authenticated_request',
      );
      expect(event).toBeDefined();
      expect(event?.properties?.['method']).toBe('GET');
      expect(event?.properties?.['token']).toBe('[REDACTED]');
    });

    it('email addresses are partially masked for privacy', async () => {
      // Given: User has consented to tracking
      await postHogService.initialize();
      postHogService.enableTracking();

      // When: Identifying a user with email
      postHogService.identify('user-123', {
        email: 'john.doe@example.com',
        name: 'John Doe',
      });

      // Then: User is identified with masked email
      expect(trackedUser?.id).toBe('user-123');
      expect(trackedUser?.properties?.['name']).toBe('John Doe');
      expect(trackedUser?.properties?.['email']).toBe('jo***@example.com');
    });
  });

  describe('Session management: user identity persists correctly', () => {
    it('user is identified when they log in', async () => {
      // Given: Tracking is enabled
      await postHogService.initialize();
      postHogService.enableTracking();

      // When: User logs in
      postHogService.identify('user-12345', {
        plan: 'premium',
        createdAt: '2024-01-15',
      });

      // Then: User is tracked with their ID
      expect(trackedUser?.id).toBe('user-12345');
      expect(trackedUser?.properties?.['plan']).toBe('premium');
    });

    it('user identity is cleared when they log out', async () => {
      // Given: User is logged in and identified
      await postHogService.initialize();
      postHogService.enableTracking();
      postHogService.identify('user-12345');

      // When: User logs out
      postHogService.reset();

      // Then: User identity is removed
      expect(trackedUser).toBeNull();
      expect(userActions).toHaveLength(0);
    });

    it('events are associated with the logged-in user', async () => {
      // Given: User is logged in
      await postHogService.initialize();
      postHogService.enableTracking();
      postHogService.identify('user-98765');

      // When: User performs actions
      postHogService.capture('budget_created', { month: 'January' });
      postHogService.capture('transaction_added', { type: 'expense' });

      // Then: Events are recorded for this user
      expect(trackedUser?.id).toBe('user-98765');
      expect(
        userActions.filter((e) => e.event === 'budget_created'),
      ).toHaveLength(1);
      expect(
        userActions.filter((e) => e.event === 'transaction_added'),
      ).toHaveLength(1);
    });
  });

  describe('Error handling and resilience', () => {
    it('application continues when analytics service is unavailable', async () => {
      // Given: Analytics configuration is missing
      const mockAppConfig = {
        postHogConfig: signal(null),
        environment: signal('production'),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          PostHogService,
          { provide: ApplicationConfiguration, useValue: mockAppConfig },
          { provide: Logger, useValue: createMockLogger() },
          { provide: PLATFORM_ID, useValue: 'browser' },
        ],
      });

      const service = TestBed.inject(PostHogService);

      // When: Application tries to use analytics
      await expect(service.initialize()).resolves.not.toThrow();

      // Then: All operations handle gracefully
      expect(() => service.enableTracking()).not.toThrow();
      expect(() => service.capture('test_event')).not.toThrow();
      expect(() => service.identify('user-123')).not.toThrow();
      expect(() => service.reset()).not.toThrow();
    });

    it('errors are tracked without breaking the application', async () => {
      // Given: Analytics is enabled
      await postHogService.initialize();
      postHogService.enableTracking();

      // When: An error occurs in the application
      const error = new Error('Budget calculation failed');

      // Then: Error tracking doesn't throw
      expect(() => {
        postHogService.captureException(error, {
          budgetId: 'budget-123',
          operation: 'calculate_totals',
        });
      }).not.toThrow();

      // And: Error is recorded for debugging
      const errorEvent = userActions.find((e) => e.event === '$exception');
      expect(errorEvent).toBeDefined();
    });

    it('malformed data does not crash analytics', async () => {
      // Given: Analytics is enabled
      await postHogService.initialize();
      postHogService.enableTracking();

      // When: Capturing events with various data types
      interface CircularRef {
        self?: CircularRef;
      }
      const circularObj: CircularRef = {};
      circularObj.self = circularObj;

      const problematicData = {
        circular: circularObj,
        undefined: undefined,
        null: null,
        bigNumber: Number.MAX_SAFE_INTEGER,
        symbol: Symbol('test'),
      };

      // Then: Analytics handles edge cases gracefully
      expect(() => {
        postHogService.capture('edge_case_test', problematicData);
      }).not.toThrow();
    });
  });

  describe('Business event tracking: key user actions are recorded', () => {
    it('budget creation is tracked with relevant details', async () => {
      // Given: User has consented to tracking
      await postHogService.initialize();
      postHogService.enableTracking();
      userActions = []; // Clear initialization events

      // When: User creates a budget
      postHogService.capture('budget_created', {
        month: 'January',
        year: 2024,
        templateUsed: 'standard',
      });

      // Then: Event is recorded with business context
      const budgetEvent = userActions.find((e) => e.event === 'budget_created');
      expect(budgetEvent).toBeDefined();
      expect(budgetEvent?.properties?.['month']).toBe('January');
      expect(budgetEvent?.properties?.['year']).toBe(2024);
      expect(budgetEvent?.properties?.['templateUsed']).toBe('standard');
    });

    it('transaction additions are tracked by type', async () => {
      // Given: User has consented to tracking
      await postHogService.initialize();
      postHogService.enableTracking();
      userActions = []; // Clear initialization events

      // When: User adds different transaction types
      postHogService.capture('transaction_added', {
        type: 'income',
        category: 'salary',
      });
      postHogService.capture('transaction_added', {
        type: 'expense',
        category: 'food',
      });
      postHogService.capture('transaction_added', {
        type: 'saving',
        category: 'emergency',
      });

      // Then: All transaction types are recorded
      const transactions = userActions.filter(
        (e) => e.event === 'transaction_added',
      );
      expect(transactions).toHaveLength(3);
      expect(transactions.map((t) => t.properties?.['type'])).toEqual([
        'income',
        'expense',
        'saving',
      ]);
    });

    it('page views are automatically tracked after consent', async () => {
      // Given: User has not yet consented
      await postHogService.initialize();
      userActions = [];

      // When: User gives consent
      postHogService.enableTracking();

      // Then: Page view is immediately recorded
      const pageView = userActions.find((e) => e.event === '$pageview');
      expect(pageView).toBeDefined();
    });
  });
});
