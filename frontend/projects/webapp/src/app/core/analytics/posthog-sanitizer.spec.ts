import { describe, expect, it } from 'vitest';

import {
  sanitizeRecord,
  sanitizeUrl,
  sanitizeEventPayload,
} from '@core/analytics';
import type { CaptureResult } from 'posthog-js';

describe('posthog-sanitizer', () => {
  describe('sanitizeUrl', () => {
    it('removes protected parameters and masks dynamic segments for absolute URLs', () => {
      const sanitized = sanitizeUrl(
        'https://app.local/budgets/123?token=abc&keep=1#details',
      );

      expect(sanitized).toBe('https://app.local/budget/[id]?keep=1#details');
    });

    it('preserves protocol-relative URLs while stripping protected parameters', () => {
      const sanitized = sanitizeUrl('//cdn.example.com/assets?token=abc');

      expect(sanitized).toBe('//cdn.example.com/assets');
    });

    it('sanitizes relative URLs using the dynamic segment masks', () => {
      const sanitized = sanitizeUrl('/transactions/456?transactionId=789');

      expect(sanitized).toBe('/transaction/[id]');
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
        profileUrl: '/budget/[id]',
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
        description: 'Safe to keep',
      });

      expect(sanitized).toEqual({
        budgetid: 'bud-123',
        templateid: 'tpl-789',
        description: 'Safe to keep',
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
        budget: {
          id: 'bud-123',
          name: 'Monthly Budget',
        },
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

      expect(sanitized).toEqual({
        transactions: [
          { id: 'tx-1', description: 'Grocery' },
          { id: 'tx-2', description: 'Gas' },
        ],
      });
    });

    it('sanitizes URLs in record properties', () => {
      const sanitized = sanitizeRecord({
        budget_url: '/budgets/123?token=abc',
        profile_link: '/transactions/456?transactionId=xyz',
        homepage: 'https://example.com/path',
        safe_property: 'keep',
      });

      expect(sanitized).toEqual({
        budget_url: '/budget/[id]',
        profile_link: '/transaction/[id]',
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

      expect(sanitized?.properties).toEqual({
        budget_id: 'bud-123',
        description: 'Monthly',
      });
    });

    it('sanitizes $set properties', () => {
      const event = {
        event: 'user_updated',
        $set: {
          user_id: 'user-123',
          balance: 5000,
          monthly_income: 6000,
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.$set).toEqual({
        user_id: 'user-123',
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

      expect(sanitized?.$set_once).toEqual({
        user_id: 'user-456',
      });
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
        'https://app.local/budget/[id]?safe=1',
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
        budget_id: 'bud-001',
        month: '2026-02',
        has_savings_goal: true,
        template_id: 'tpl-123',
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
        description: 'Grocery shopping',
        kind: 'expense',
        budget_id: 'bud-456',
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
        budget: {
          id: 'bud-123',
          name: 'Monthly',
          lines: [
            { id: 'line-1', name: 'Groceries' },
            { id: 'line-2', name: 'Transport' },
          ],
        },
        export_format: 'csv',
        user_id: 'usr-456',
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
        goal_id: 'sg-001',
        name: 'Emergency Fund',
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
            { id: 'tx-1', amount: 100, category: 'food', balance: 2900 },
            { id: 'tx-2', amount: 50, category: 'transport', balance: 2850 },
          ],
          view_duration_seconds: 45,
          has_savings: true,
        },
      } as unknown as CaptureResult;

      const sanitized = sanitizeEventPayload(event);

      expect(sanitized?.properties).toEqual({
        budget_id: 'bud-123',
        transactions: [
          { id: 'tx-1', category: 'food' },
          { id: 'tx-2', category: 'transport' },
        ],
        view_duration_seconds: 45,
        has_savings: true,
      });
    });
  });
});
