import { describe, expect, it } from 'vitest';

import {
  sanitizeRecord,
  sanitizeUrl,
  sanitizeEventPayload,
} from '@core/analytics';
import type { CaptureResult } from 'posthog-js';

describe('posthog-sanitizer', () => {
  describe('sanitizeUrl', () => {
    it('drops every query parameter and hash fragment by default', () => {
      const sanitized = sanitizeUrl(
        '/budgets/example-budget-id?email=private%40example.test&unknown=private#details',
      );

      expect(sanitized).toBe('/budgets/[id]');
    });

    it.each([
      ['/savings-goals/example-goal-id', '/savings-goals/[id]'],
      [
        '/budget-templates/details/example-template-id',
        '/budget-templates/details/[id]',
      ],
      ['/api/v1/savings-goals/example-goal-id', '/api/v1/savings-goals/[id]'],
      [
        '/api/v1/transactions/budget/example-budget-id',
        '/api/v1/transactions/budget/[id]',
      ],
      [
        '/api/v1/budget-lines/example-line-id/toggle-check',
        '/api/v1/budget-lines/[id]/toggle-check',
      ],
      [
        '/api/v1/budget-lines/spread/example-group-id',
        '/api/v1/budget-lines/spread/[id]',
      ],
      [
        '/api/v1/budget-lines/savings-withdrawal/example-group-id',
        '/api/v1/budget-lines/savings-withdrawal/[id]',
      ],
      [
        '/api/v1/budget-templates/example-template-id/lines/example-line-id',
        '/api/v1/budget-templates/[id]/lines/[id]',
      ],
      [
        '/api/v1/budget-templates/example-template-id/lines/bulk-operations',
        '/api/v1/budget-templates/[id]/lines/bulk-operations',
      ],
      ['/api/v1/budgets/example-budget-id', '/api/v1/budgets/[id]'],
      [
        '/api/v1/transactions/example-transaction-id',
        '/api/v1/transactions/[id]',
      ],
      ['/budget/example-budget-id', '/budget/[id]'],
      [
        '/api/v1/debug/test-error/example-type',
        '/api/v1/debug/test-error/[id]',
      ],
      ['/api/v1/tags/example-tag-id/history', '/api/v1/tags/[id]/history'],
    ])(
      'masks identifiers across web and API resource routes',
      (url, expected) => {
        expect(sanitizeUrl(url)).toBe(expected);
      },
    );

    it.each([
      '/budgets/generate',
      '/budgets/export',
      '/budgets/exists',
      '/transactions/search',
      '/budget-lines/spread',
      '/budget-lines/savings-withdrawal',
      '/budget-templates/from-onboarding',
      '/budget-templates/create',
      '/savings-goals/withdrawal-options',
    ])('preserves static collection routes such as %s', (url) => {
      expect(sanitizeUrl(url)).toBe(url);
    });

    it.each([
      'data:text/plain,private',
      'javascript:private',
      '\njavascript:private',
      '\tdata:text/plain,private',
      'java\nscript:private',
      'java\tscript:private',
      '\u0000javascript:private',
    ])('fails closed for unsupported URL schemes', (url) => {
      expect(sanitizeUrl(url)).toBe('');
    });

    it.each(['', '$direct'])(
      'preserves the non-sensitive PostHog referrer sentinel %j',
      (value) => {
        expect(sanitizeUrl(value)).toBe(value);
      },
    );

    it('drops query and fragment while masking absolute URLs', () => {
      const sanitized = sanitizeUrl(
        'https://app.local/budgets/123?token=abc&keep=1#details',
      );

      expect(sanitized).toBe('https://app.local/budgets/[id]');
    });

    it('preserves protocol-relative URLs while stripping protected parameters', () => {
      const sanitized = sanitizeUrl('//cdn.example.com/assets?token=abc');

      expect(sanitized).toBe('//cdn.example.com');
    });

    it.each([
      [
        'https://external.example/private-user-value?source=private#details',
        'https://external.example',
      ],
      ['/future/private-user-value?source=private', '/'],
      [
        '//cdn.example.com/private-user-value?source=private',
        '//cdn.example.com',
      ],
      ['/private-prefix/budgets/private-budget-id', '/'],
    ])('fails closed for unrecognized path shapes', (url, expected) => {
      expect(sanitizeUrl(url)).toBe(expected);
    });

    it.each([
      '/welcome',
      '/login',
      '/dashboard',
      '/settings',
      '/settings/tags',
      '/legal/cgu',
      '/maintenance',
    ])('preserves known static application paths', (url) => {
      expect(sanitizeUrl(url)).toBe(url);
    });

    it('sanitizes relative URLs using the dynamic segment masks', () => {
      const sanitized = sanitizeUrl('/transactions/456?transactionId=789');

      expect(sanitized).toBe('/transactions/[id]');
    });

    it.each([
      [
        'https://app.local/budgets/123?access_token=a&refresh_token=b&password=c&recovery_key=d&keep=1',
        'https://app.local/budgets/[id]',
      ],
      [
        '//cdn.example.com/assets?access_token=a&refresh_token=b&password=c&recovery_key=d&keep=1',
        '//cdn.example.com',
      ],
      [
        '/transactions/456?access_token=a&refresh_token=b&password=c&recovery_key=d&keep=1',
        '/transactions/[id]',
      ],
    ])(
      'drops all parameters while preserving the URL format',
      (url, expected) => {
        expect(sanitizeUrl(url)).toBe(expected);
      },
    );

    it('fails closed when the URL cannot be parsed', () => {
      expect(sanitizeUrl('http://[invalid')).toBe('');
    });
  });

  describe('sanitizeRecord', () => {
    it('filters sensitive fields while keeping safe properties', () => {
      const sanitized = sanitizeRecord({
        apiKey: 'secret',
        amount: 1200,
        journeyKey: 'stay-visible',
        profileUrl: '/budgets/999?token=abc',
      });

      expect(sanitized).toEqual({
        journeyKey: 'stay-visible',
        profileUrl: '/budgets/[id]',
      });
    });

    it('removes all financial property names (case-insensitive)', () => {
      const sanitized = sanitizeRecord({
        Amount: 5000,
        BALANCE: 3000,
        available_amount: 2000,
        availableamount: 1500,
        planned_amount: 4000,
        plannedamount: 3500,
        budget_amount: 6000,
        budgetamount: 5500,
        total: 10000,
        Income: 8000,
        EXPENSE: 2000,
        expenses: 2500,
        Saving: 1000,
        SAVINGS: 1500,
        safe_field: 'keep_this',
      });

      expect(sanitized).toEqual({
        safe_field: 'keep_this',
      });
    });

    it('removes fields containing sensitive keywords', () => {
      const sanitized = sanitizeRecord({
        password: 'secret123',
        user_password: 'also_secret',
        secret_key: 'hidden',
        api_credential: 'token',
        credit_card: '1234-5678',
        creditcard: '4321-8765',
        ssn: '123-45-6789',
        social_security_number: '987-65-4321',
        safe_name: 'John',
      });

      expect(sanitized).toEqual({
        safe_name: 'John',
      });
    });

    it('removes protected query parameters and sensitive IDs', () => {
      const sanitized = sanitizeRecord({
        budgetid: 'bud-123',
        transactionid: 'tx-456',
        templateid: 'tpl-789',
        token: 'auth-token',
        description: 'Personal budget label',
      });

      expect(sanitized).toEqual({});
    });

    it('preserves the request_id correlation id (snake_case and camelCase)', () => {
      const requestId = 'feedf00d-dead-beef-cafe-1234567890ab';
      const sanitized = sanitizeRecord({
        request_id: requestId,
        requestId,
        source: 'http_interceptor',
      });

      expect(sanitized).toEqual({
        request_id: requestId,
        requestId,
        source: 'http_interceptor',
      });
    });

    it('preserves the PostHog technical and request correlation identifiers', () => {
      const identifiers = {
        distinct_id: 'technical-distinct-id',
        $device_id: 'technical-device-id',
        $session_id: 'technical-session-id',
        $window_id: 'technical-window-id',
        $user_id: 'technical-user-id',
        $anon_distinct_id: 'technical-anonymous-id',
        $pageview_id: 'technical-pageview-id',
        $insert_id: 'technical-insert-id',
        request_id: 'technical-request-id',
        requestId: 'technical-request-id',
      };

      expect(sanitizeRecord(identifiers)).toEqual(identifiers);
    });

    it('removes singular, plural, UUID and identifier-shaped business keys', () => {
      const sanitized = sanitizeRecord({
        id: 'private-id',
        ids: ['private-id'],
        budget_ids: ['private-budget-id'],
        goalIds: ['private-goal-id'],
        templateUUID: 'private-template-uuid',
        resource_uuid: 'private-resource-uuid',
        identifier: 'private-identifier',
        externalIdentifiers: ['private-external-identifier'],
        $budget_id: 'private-prefixed-budget-id',
        valid: true,
        grid: 'month',
        paid: false,
      });

      expect(sanitized).toEqual({
        valid: true,
        grid: 'month',
        paid: false,
      });
    });

    it('recursively sanitizes nested objects', () => {
      const sanitized = sanitizeRecord({
        budget: {
          id: 'bud-123',
          name: 'Monthly Budget',
          amount: 5000,
          balance: 3000,
        },
        metadata: {
          created: '2026-02-01',
          safe_info: 'keep',
        },
      });

      expect(sanitized).toEqual({
        budget: {},
        metadata: {
          created: '2026-02-01',
          safe_info: 'keep',
        },
      });
    });

    it('recursively sanitizes arrays of objects', () => {
      const sanitized = sanitizeRecord({
        transactions: [
          { id: 'tx-1', amount: 100, description: 'Grocery' },
          { id: 'tx-2', amount: 200, description: 'Gas' },
        ],
      });

      expect(sanitized).toEqual({ transactions: [{}, {}] });
    });

    it('drops cyclic branches without throwing or losing safe siblings', () => {
      const cyclic: Record<string, unknown> = {
        safe_state: 'completed',
      };
      cyclic['loop'] = cyclic;

      expect(() => sanitizeRecord(cyclic)).not.toThrow();
      expect(sanitizeRecord(cyclic)).toEqual({ safe_state: 'completed' });
    });

    it('drops branches beyond the generic traversal depth budget', () => {
      const root: Record<string, unknown> = {};
      let current = root;
      for (let depth = 0; depth < 100; depth++) {
        const next: Record<string, unknown> = {};
        current['child'] = next;
        current = next;
      }
      current['private_sentinel'] = 'must-not-survive';

      const sanitized = sanitizeRecord({ safe_state: 'completed', root });

      expect(sanitized['safe_state']).toBe('completed');
      expect(JSON.stringify(sanitized)).not.toContain('must-not-survive');
    });

    it('sanitizes URLs in record properties', () => {
      const sanitized = sanitizeRecord({
        budget_url: '/budgets/123?token=abc',
        profile_link: '/transactions/456?transactionId=xyz',
        homepage: 'https://example.com/path',
        safe_property: 'keep',
      });

      expect(sanitized).toEqual({
        budget_url: '/budgets/[id]',
        profile_link: '/transactions/[id]',
        homepage: 'https://example.com/path',
        safe_property: 'keep',
      });
    });
  });

  describe('sanitizeEventPayload', () => {
    it('sanitizes event properties', () => {
      const event = {
        event: 'budget_created',
        properties: {
          budget_id: 'bud-123',
          planned_amount: 5000,
          description: 'Monthly',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties).toEqual({});
    });

    it('sanitizes $set properties while keeping intentional person metadata', () => {
      const event = {
        event: 'user_updated',
        $set: {
          user_id: 'user-123',
          email: 'user@example.test',
          name: 'First name',
          supabase_user_id: 'technical-user-id',
          currency: 'CHF',
          balance: 5000,
          monthly_income: 6000,
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.$set).toEqual({
        email: 'user@example.test',
        name: 'First name',
        supabase_user_id: 'technical-user-id',
        currency: 'CHF',
      });
    });

    it('sanitizes $set_once properties', () => {
      const event = {
        event: 'user_created',
        $set_once: {
          user_id: 'user-456',
          initial_balance: 0,
          signup_amount: 100,
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.$set_once).toEqual({});
    });

    it('sanitizes $current_url system property', () => {
      const event = {
        event: '$pageview',
        properties: {
          $current_url: 'https://app.local/budgets/123?token=abc&safe=1',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties?.['$current_url']).toBe(
        'https://app.local/budgets/[id]',
      );
    });

    it('drops the visible document title added by PostHog pageviews', () => {
      const event = {
        event: '$pageview',
        properties: {
          title: 'PRIVATE_VISIBLE_PAGE_TITLE',
          $pathname: '/budgets/example-budget-id',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties?.['title']).toBeUndefined();
      expect(sanitized?.properties?.['$pathname']).toBe('/budgets/[id]');
      expect(JSON.stringify(sanitized)).not.toContain(
        'PRIVATE_VISIBLE_PAGE_TITLE',
      );
    });

    it('masks dynamic resource IDs in the $pathname system property', () => {
      const event = {
        event: '$pageview',
        properties: {
          $pathname: '/budgets/example-budget-id',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties?.['$pathname']).toBe('/budgets/[id]');
    });

    it.each(['$prev_pageview_pathname', '$initial_pathname'])(
      'masks dynamic resource IDs in the %s system property',
      (property) => {
        const event = {
          event: '$pageview',
          properties: {
            [property]:
              '/budget-templates/example-template-id/lines/example-line-id',
          },
        } as unknown as CaptureResult;

        const sanitized = sanitizeEventPayload(event);

        expect(sanitized?.properties?.[property]).toBe(
          '/budget-templates/[id]/lines/[id]',
        );
      },
    );

    it.each([
      '$referrer',
      '$initial_referrer',
      '$session_entry_referrer',
      '$session_entry_url',
    ])('sanitizes the %s system URL property', (property) => {
      const event = {
        event: '$pageview',
        properties: {
          [property]:
            'https://app.local/savings-goals/example-goal-id?email=private%40example.test#details',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties?.[property]).toBe(
        'https://app.local/savings-goals/[id]',
      );
    });

    it('drops query-derived campaign and search values from authenticated app events', () => {
      const event = {
        event: '$pageview',
        properties: {
          utm_source: 'private-source-value',
          gclid: 'private-click-value',
          ph_keyword: 'private-search-value',
          $initial_utm_campaign: 'private-campaign-value',
          $session_entry_utm_source: 'private-session-source-value',
          $session_entry_gclid: 'private-session-click-value',
          $session_entry_ph_keyword: 'private-session-search-value',
          environment: 'production',
          platform: 'web',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties).toEqual({
        environment: 'production',
        platform: 'web',
      });
    });

    it('rebuilds useful autocapture structure without DOM text or attributes', () => {
      const privateSentinels = [
        'example-budget-id',
        'private-token',
        'Private budget label',
        'private-css-class',
        'private-selector',
      ];
      const event = {
        event: '$autocapture',
        properties: {
          $event_type: 'click',
          $ce_version: 1,
          $elements_chain:
            'a.private-css-class:nth-child="2"nth-of-type="1"attr__href="/budgets/example-budget-id?token=private-token"',
          $elements: [
            {
              tag_name: 'a',
              classes: ['private-css-class'],
              nth_child: 2,
              nth_of_type: 1,
              attr__id: 'example-budget-id',
              attr__href: '/budgets/example-budget-id?token=private-token',
              $el_text: 'Private budget label',
            },
            {
              tag_name: 'nav',
              classes: ['private-css-class'],
              nth_child: 1,
              nth_of_type: 1,
            },
          ],
          $element_selectors: ['#private-selector'],
          $el_text: 'Private budget label',
          $external_click_url:
            'https://app.local/budgets/example-budget-id?token=private-token',
          private_context: 'Private budget label',
          environment: 'production',
          platform: 'web',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);
      const serialized = JSON.stringify(sanitized);

      expect(sanitized?.properties).toEqual({
        $event_type: 'click',
        $ce_version: 1,
        $elements: [
          { tag_name: 'a', nth_child: 2, nth_of_type: 1 },
          { tag_name: 'nav', nth_child: 1, nth_of_type: 1 },
        ],
        $elements_chain:
          'a:nth-child="2"nth-of-type="1";nav:nth-child="1"nth-of-type="1"',
        environment: 'production',
        platform: 'web',
      });
      for (const sentinel of privateSentinels) {
        expect(serialized).not.toContain(sentinel);
      }
    });

    it.each(['change', 'submit', 'copy', 'cut'])(
      'drops unsupported %s autocapture events',
      (eventType) => {
        const event = {
          event: '$autocapture',
          properties: {
            $event_type: eventType,
            $ce_version: 1,
            $elements: [{ tag_name: 'input', nth_child: 1, nth_of_type: 1 }],
            environment: 'production',
          },
        } as unknown as CaptureResult;

        expect(sanitizeEventPayload(event)).toBeNull();
      },
    );

    it('drops malformed autocapture element structures', () => {
      const event = {
        event: '$autocapture',
        properties: {
          $event_type: 'click',
          $ce_version: 1,
          $elements: [
            {
              tag_name: 'button',
              nth_child: 'private-position',
              nth_of_type: 1,
            },
          ],
        },
      } as unknown as CaptureResult;

      expect(sanitizeEventPayload(event)).toBeNull();
    });

    it('drops autocapture events with missing properties', () => {
      const event = {
        event: '$autocapture',
        properties: null,
      } as unknown as CaptureResult;

      expect(sanitizeEventPayload(event)).toBeNull();
    });

    it('sanitizes uncompressed rrweb snapshots before they leave the browser', () => {
      const privateSentinels = [
        'example-budget-id',
        'private-query-value',
        'Private budget label',
        'private-style-value',
        'private-config-value',
      ];
      const event = {
        event: '$snapshot',
        properties: {
          $snapshot_bytes: 9999,
          $snapshot_data: [
            {
              type: 4,
              data: {
                href: 'https://app.local/budgets/example-budget-id?token=private-query-value#details',
                width: 1280,
                height: 720,
              },
              timestamp: 1,
            },
            {
              type: 2,
              data: {
                node: {
                  type: 0,
                  id: 1,
                  childNodes: [
                    {
                      type: 1,
                      id: 4,
                      name: 'html',
                      publicId: 'private-doctype-public-id',
                      systemId: 'private-doctype-system-id',
                    },
                    {
                      type: 2,
                      id: 2,
                      tagName: 'a',
                      isShadowHost: true,
                      attributes: {
                        id: 'budget-example-budget-id',
                        'data-testid': 'budget-example-budget-id',
                        'aria-label': 'Private budget label',
                        href: '/budgets/example-budget-id?token=private-query-value',
                        class: 'budget-card active',
                        style:
                          'background-image:url(https://private-style-value.test/image)',
                      },
                      childNodes: [
                        {
                          type: 3,
                          id: 3,
                          textContent: 'Private budget label',
                        },
                      ],
                    },
                  ],
                },
                initialOffset: { top: 0, left: 0 },
              },
              timestamp: 2,
            },
            {
              type: 3,
              data: {
                source: 0,
                texts: [{ id: 3, value: 'Private budget label' }],
                attributes: [
                  {
                    id: 2,
                    attributes: {
                      'data-testid': 'budget-example-budget-id',
                      href: '/budgets/example-budget-id?token=private-query-value',
                      style: 'background:url(https://private-style-value.test)',
                    },
                  },
                ],
                removes: [],
                adds: [],
              },
              timestamp: 3,
            },
            {
              type: 3,
              data: {
                source: 5,
                id: 5,
                text: 'Private input value',
                isChecked: false,
              },
              timestamp: 3.5,
            },
            {
              type: 3,
              data: {
                source: 8,
                adds: [
                  {
                    rule: 'body{background:url(https://private-style-value.test)}',
                  },
                ],
              },
              timestamp: 4,
            },
            {
              type: 5,
              data: {
                tag: '$posthog_config',
                payload: { token: 'private-config-value' },
              },
              timestamp: 5,
            },
          ],
          environment: 'production',
          platform: 'web',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);
      const serialized = JSON.stringify(
        sanitized?.properties?.['$snapshot_data'],
      );

      expect(sanitized).not.toBeNull();
      expect(serialized).toContain('/budgets/[id]');
      expect(serialized).not.toContain('budget-card active');
      expect(serialized).toContain('******* ****** *****');
      expect(serialized).toContain('"name":"html"');
      expect(serialized).toContain('"text":"******* ***** *****"');
      expect(serialized).toContain('"isShadowHost":true');
      expect(serialized).not.toContain('private-doctype');
      for (const sentinel of privateSentinels) {
        expect(serialized).not.toContain(sentinel);
      }
      expect(sanitized?.properties?.['$snapshot_data']).toHaveLength(5);
      expect(serialized).toContain('"tag":"$posthog_config"');
      expect(serialized).toContain('"payload":{}');
      expect(sanitized?.properties?.['$snapshot_bytes']).not.toBe(9999);
      const sanitizedEvents = sanitized?.properties?.[
        '$snapshot_data'
      ] as Record<string, unknown>[];
      expect(sanitized?.properties?.['$snapshot_bytes']).toBe(
        sanitizedEvents.reduce<number>(
          (total, replayEvent) => total + JSON.stringify(replayEvent).length,
          0,
        ),
      );
      expect(sanitized?.properties?.['environment']).toBe('production');
      expect(sanitized?.properties?.['platform']).toBe('web');
    });

    it('keeps valid rrweb attribute shapes without retaining their free-form values', () => {
      const event = {
        event: '$snapshot',
        properties: {
          $snapshot_data: [
            {
              type: 2,
              timestamp: 1,
              data: {
                initialOffset: { top: 0, left: 0 },
                node: {
                  type: 0,
                  id: 1,
                  childNodes: [
                    {
                      type: 2,
                      id: 2,
                      tagName: 'input',
                      attributes: {
                        type: 'hidden',
                        disabled: 'disabled',
                      },
                      childNodes: [],
                    },
                    {
                      type: 2,
                      id: 3,
                      tagName: 'object',
                      attributes: {
                        type: 'application/private-value',
                      },
                      childNodes: [],
                    },
                  ],
                },
              },
            },
          ],
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);
      const serialized = JSON.stringify(sanitized);

      expect(sanitized).not.toBeNull();
      expect(serialized).toContain('"type":"hidden"');
      expect(serialized).toContain('"disabled":""');
      expect(serialized).not.toContain('private-value');
    });

    it.each(['color', 'datetime-local', 'file', 'image', 'month', 'week'])(
      'preserves the safe structural input type %s',
      (inputType) => {
        const event = {
          event: '$snapshot',
          properties: {
            $snapshot_data: [
              {
                type: 2,
                timestamp: 1,
                data: {
                  initialOffset: { top: 0, left: 0 },
                  node: {
                    type: 0,
                    id: 1,
                    childNodes: [
                      {
                        type: 2,
                        id: 2,
                        tagName: 'input',
                        attributes: { type: inputType },
                        childNodes: [],
                      },
                    ],
                  },
                },
              },
            ],
          },
        } as unknown as CaptureResult;

        expect(
          JSON.stringify(
            sanitizeEventPayload(event)?.properties?.['$snapshot_data'],
          ),
        ).toContain(`"type":"${inputType}"`);
      },
    );

    it.each(['$pageview', '$url_changed'])(
      'preserves the %s replay marker with only a sanitized href',
      (tag) => {
        const event = {
          event: '$snapshot',
          properties: {
            $snapshot_data: [
              {
                type: 5,
                timestamp: 1,
                data: {
                  tag,
                  payload: {
                    href: 'https://app.local/budgets/example-budget-id?token=private#details',
                    private_context: 'private-value',
                  },
                },
              },
            ],
          },
        } as unknown as CaptureResult;

        const sanitized = sanitizeEventPayload(event);

        expect(sanitized?.properties?.['$snapshot_data']).toEqual([
          {
            type: 5,
            timestamp: 1,
            data: {
              tag,
              payload: {
                href: 'https://app.local/budgets/[id]',
              },
            },
          },
        ]);
        expect(JSON.stringify(sanitized)).not.toContain('private-value');
      },
    );

    it('preserves privacy-safe replay lifecycle markers in marker-only batches', () => {
      const privateSentinel = 'PRIVATE_REPLAY_MARKER_SENTINEL';
      const previousSessionId = '018f779c-b3c0-7f4e-8f1a-1234567890ab';
      const nextSessionId = '018f779d-c4d1-7a5f-9e2b-abcdef123456';
      const event = {
        event: '$snapshot',
        properties: {
          $snapshot_data: [
            {
              type: 5,
              timestamp: 1,
              data: {
                tag: '$session_starting',
                payload: {
                  previousSessionId,
                  nextSessionId,
                  previousWindowId: '018f779c-b3c0-7f4e-8f1a-aaaaaaaaaaaa',
                  private_context: privateSentinel,
                },
              },
            },
            {
              type: 5,
              timestamp: 2,
              data: {
                tag: '$session_ending',
                payload: {
                  previousSessionId,
                  nextSessionId,
                  nextWindowId: '018f779d-c4d1-7a5f-9e2b-bbbbbbbbbbbb',
                  private_context: privateSentinel,
                },
              },
            },
            {
              type: 5,
              timestamp: 3,
              data: {
                tag: '$recording_started',
                payload: {
                  reason: 'recording_initialized',
                  matchedUrl: privateSentinel,
                },
              },
            },
            {
              type: 5,
              timestamp: 4,
              data: {
                tag: 'samplingDecisionMade',
                payload: {
                  sampleRate: 0.1,
                  isSampled: true,
                  private_context: privateSentinel,
                },
              },
            },
            {
              type: 5,
              timestamp: 5,
              data: {
                tag: '$posthog_config',
                payload: { token: privateSentinel },
              },
            },
          ],
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties?.['$snapshot_data']).toEqual([
        {
          type: 5,
          timestamp: 1,
          data: {
            tag: '$session_starting',
            payload: { previousSessionId },
          },
        },
        {
          type: 5,
          timestamp: 2,
          data: {
            tag: '$session_ending',
            payload: { nextSessionId },
          },
        },
        {
          type: 5,
          timestamp: 3,
          data: {
            tag: '$recording_started',
            payload: {},
          },
        },
        {
          type: 5,
          timestamp: 4,
          data: {
            tag: 'samplingDecisionMade',
            payload: {},
          },
        },
        {
          type: 5,
          timestamp: 5,
          data: { tag: '$posthog_config', payload: {} },
        },
      ]);
      expect(JSON.stringify(sanitized)).not.toContain(privateSentinel);
    });

    it('drops a replay session-link marker with a non-UUIDv7 session ID', () => {
      const event = {
        event: '$snapshot',
        properties: {
          $snapshot_data: [
            {
              type: 5,
              timestamp: 1,
              data: {
                tag: '$session_starting',
                payload: { previousSessionId: 'private-free-form-value' },
              },
            },
          ],
        },
      } as unknown as CaptureResult;

      expect(sanitizeEventPayload(event)).toBeNull();
    });

    it.each([
      ['mouse interaction type', { source: 2, id: 1, type: 11, x: 0, y: 0 }],
      [
        'mouse pointer type',
        { source: 2, id: 1, type: 2, pointerType: 3, x: 0, y: 0 },
      ],
      ['media interaction type', { source: 7, id: 1, type: 5, currentTime: 0 }],
    ])('rejects an out-of-range rrweb %s', (_label, data) => {
      const event = {
        event: '$snapshot',
        properties: {
          $snapshot_data: [{ type: 3, timestamp: 1, data }],
        },
      } as unknown as CaptureResult;

      expect(sanitizeEventPayload(event)).toBeNull();
    });

    it('drops compressed or malformed replay payloads fail closed', () => {
      const event = {
        event: '$snapshot',
        properties: {
          $snapshot_data: [
            {
              type: 2,
              cv: '2024-10',
              data: 'opaque-private-compressed-payload',
              timestamp: 1,
            },
          ],
        },
      } as unknown as CaptureResult;

      expect(sanitizeEventPayload(event)).toBeNull();
    });

    it('drops cyclic replay payloads without throwing', () => {
      const node: Record<string, unknown> = {
        type: 0,
        id: 1,
        childNodes: [],
      };
      (node['childNodes'] as unknown[]).push(node);
      const event = {
        event: '$snapshot',
        properties: {
          $snapshot_data: [
            {
              type: 2,
              timestamp: 1,
              data: { node, initialOffset: { top: 0, left: 0 } },
            },
          ],
        },
      } as unknown as CaptureResult;

      expect(() => sanitizeEventPayload(event)).not.toThrow();
      expect(sanitizeEventPayload(event)).toBeNull();
    });

    it('drops replay payloads beyond the traversal depth budget', () => {
      const root: Record<string, unknown> = {
        type: 0,
        id: 1,
        childNodes: [],
      };
      let current = root;
      for (let depth = 0; depth < 100; depth++) {
        const child: Record<string, unknown> = {
          type: 2,
          id: depth + 2,
          tagName: 'div',
          attributes: {},
          childNodes: [],
        };
        (current['childNodes'] as unknown[]).push(child);
        current = child;
      }
      const event = {
        event: '$snapshot',
        properties: {
          $snapshot_data: [
            {
              type: 2,
              timestamp: 1,
              data: { node: root, initialOffset: { top: 0, left: 0 } },
            },
          ],
        },
      } as unknown as CaptureResult;

      expect(() => sanitizeEventPayload(event)).not.toThrow();
      expect(sanitizeEventPayload(event)).toBeNull();
    });

    it('preserves business properties that merely contain pathname in their key', () => {
      const event = {
        event: 'navigation_diagnostic',
        properties: {
          pathname_strategy: 'history based',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties?.['pathname_strategy']).toBe(
        'history based',
      );
    });

    it('handles null or missing properties gracefully', () => {
      const event = {
        event: 'test_event',
        properties: null,
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized).toEqual(event);
    });

    it('returns null when event is null', () => {
      const sanitized = sanitizeEventPayload(null);

      expect(sanitized).toBeNull();
    });

    it('preserves PostHog SDK token through sanitization', () => {
      const event = {
        event: 'test_event',
        properties: {
          token: 'phc_sdk_project_token',
          planned_amount: 5000,
          safe_property: 'keep',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties?.['token']).toBe('phc_sdk_project_token');
      expect(sanitized?.properties?.['planned_amount']).toBeUndefined();
      expect(sanitized?.properties?.['safe_property']).toBe('keep');
    });

    it('removes exception values and source context while preserving grouping frames', () => {
      const sentinel = 'PRIVATE_EXCEPTION_SENTINEL';
      const event = {
        event: '$exception',
        properties: {
          $exception_message: sentinel,
          $exception_values: [sentinel],
          $exception_types: [sentinel],
          $exception_fingerprint: sentinel,
          $exception_level: 'error',
          $exception_list: [
            {
              type: 'TypeError',
              value: sentinel,
              mechanism: {
                type: 'generic',
                handled: true,
                source: sentinel,
              },
              stacktrace: {
                type: 'raw',
                frames: [
                  {
                    platform: 'web:javascript',
                    filename: `/main.js?input=${sentinel}`,
                    function: 'loadBudget',
                    lineno: 12,
                    colno: 4,
                    context_line: sentinel,
                    pre_context: [sentinel],
                    vars: { payload: sentinel },
                  },
                ],
              },
            },
          ],
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);
      const output = JSON.stringify(sanitized);
      const exception = (
        sanitized?.properties?.['$exception_list'] as Record<string, unknown>[]
      )[0];

      expect(output).not.toContain(sentinel);
      expect(sanitized?.properties?.['$exception_message']).toBeUndefined();
      expect(sanitized?.properties?.['$exception_values']).toBeUndefined();
      expect(sanitized?.properties?.['$exception_types']).toBeUndefined();
      expect(sanitized?.properties?.['$exception_fingerprint']).toBeUndefined();
      expect(sanitized?.properties?.['$exception_level']).toBe('error');
      expect(exception).not.toHaveProperty('value');
      expect(exception).toMatchObject({
        type: 'TypeError',
        mechanism: { type: 'generic', handled: true },
        stacktrace: {
          frames: [
            {
              platform: 'web:javascript',
              filename: '/main.js',
              function: 'loadBudget',
              lineno: 12,
              colno: 4,
            },
          ],
        },
      });
    });

    it('drops malformed exception payloads instead of sending them', () => {
      const event = {
        event: '$exception',
        properties: {
          $exception_list: [{ type: 'Error', stacktrace: 'raw stack' }],
        },
      } as unknown as CaptureResult;

      expect(sanitizeEventPayload(event)).toBeNull();
    });

    it('does not copy arbitrary strings from exception grouping fields', () => {
      const sentinel = 'PRIVATE_GROUPING_SENTINEL';
      const event = {
        event: '$exception',
        properties: {
          $exception_list: [
            {
              type: sentinel,
              module: sentinel,
              mechanism: {
                type: sentinel,
                handled: true,
                synthetic: false,
              },
              stacktrace: {
                frames: [
                  {
                    platform: sentinel,
                    function: sentinel,
                    module: sentinel,
                    instruction_addr: sentinel,
                    addr_mode: sentinel,
                    chunk_id: sentinel,
                    filename: `/main.js?q=${sentinel}`,
                    lineno: 12,
                    colno: 4,
                    in_app: true,
                  },
                ],
              },
            },
          ],
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);
      const output = JSON.stringify(sanitized);
      const exception = (
        sanitized?.properties?.['$exception_list'] as Record<string, unknown>[]
      )[0];

      expect(output).not.toContain(sentinel);
      expect(exception).toMatchObject({
        type: 'Error',
        mechanism: { type: 'generic', handled: true, synthetic: false },
        stacktrace: {
          frames: [
            {
              platform: 'web:javascript',
              filename: '/main.js',
              lineno: 12,
              colno: 4,
              in_app: true,
            },
          ],
        },
      });
    });
  });

  describe('Real component data flow scenarios', () => {
    it('sanitizes budget creation event with amount data', () => {
      const event = {
        event: 'budget_created',
        properties: {
          budget_id: 'bud-001',
          month: '2026-02',
          planned_amount: 5000,
          has_savings_goal: true,
          template_id: 'tpl-123',
          charges_count: 5,
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties).toEqual({
        month: '2026-02',
        has_savings_goal: true,
        charges_count: 5,
      });
    });

    it('sanitizes transaction recording with amount and balance', () => {
      const event = {
        event: 'transaction_added',
        properties: {
          transaction_id: 'tx-789',
          amount: 250.5,
          description: 'Grocery shopping',
          budget_line_id: 'line-123',
          balance: 4750.5,
          kind: 'expense',
          budget_id: 'bud-456',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties).toEqual({
        kind: 'expense',
      });
    });

    it('sanitizes dashboard view event with all financial data', () => {
      const event = {
        event: 'dashboard_viewed',
        properties: {
          total_income: 6000,
          total_expenses: 4000,
          total_savings: 2000,
          balance_available: 1500,
          months_visible: 6,
          has_template: true,
          environment: 'production',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties).toEqual({
        months_visible: 6,
        has_template: true,
        environment: 'production',
      });
    });

    it('sanitizes deeply nested budget object with arrays', () => {
      const event = {
        event: 'budget_exported',
        properties: {
          budget: {
            id: 'bud-123',
            name: 'Monthly',
            amount: 5000,
            balance: 3000,
            lines: [
              { id: 'line-1', name: 'Groceries', amount: 1000 },
              { id: 'line-2', name: 'Transport', amount: 500 },
            ],
          },
          export_format: 'csv',
          user_id: 'usr-456',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties).toEqual({
        budget: { lines: [{}, {}] },
        export_format: 'csv',
      });
    });

    it('sanitizes encrypted DB fields and derived financial values', () => {
      const event = {
        event: 'savings_goal_viewed',
        properties: {
          goal_id: 'sg-001',
          target_amount: 10000,
          ending_balance: 4500,
          consumed: 300,
          remaining: 700,
          spent: 250,
          earned: 3000,
          saved: 500,
          name: 'Emergency Fund',
          status: 'ACTIVE',
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties).toEqual({
        status: 'ACTIVE',
      });
    });

    it('sanitizes event with mixed sensitive and safe fields at multiple levels', () => {
      const event = {
        event: 'budget_details_viewed',
        properties: {
          budget_id: 'bud-123',
          planned_amount: 5000,
          available_amount: 3000,
          total_income: 8000,
          transactions: [
            { id: 'tx-1', amount: 100, label: 'food', balance: 2900 },
            { id: 'tx-2', amount: 50, label: 'transport', balance: 2850 },
          ],
          view_duration_seconds: 45,
          has_savings: true,
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties).toEqual({
        transactions: [{}, {}],
        view_duration_seconds: 45,
        has_savings: true,
      });
    });

    it('strips recovery keys, tokens, and typed business text recursively', () => {
      const sanitized = sanitizeRecord({
        recovery_key: 'PULPE-SECRET-KEY',
        accessToken: 'jwt',
        label: 'Loyer',
        nested: {
          title: 'Vacances',
          content: 'Texte saisi librement',
          safe_state: 'completed',
        },
      });

      expect(sanitized).toEqual({
        nested: {
          safe_state: 'completed',
        },
      });
    });
  });
});
