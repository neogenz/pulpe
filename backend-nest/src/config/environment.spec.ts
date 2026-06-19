import { describe, expect, it } from 'bun:test';
import { validateConfig } from './environment';

describe('Environment Validation', () => {
  describe('SUPABASE_SERVICE_ROLE_KEY', () => {
    it('should be required in all environments including development', () => {
      const config = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_ANON_KEY: 'test-anon-key',
        TURNSTILE_SECRET_KEY: 'test-turnstile-key',
        ENCRYPTION_MASTER_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        // SERVICE_ROLE_KEY omitted - should fail
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('should be required in test environment', () => {
      const config = {
        NODE_ENV: 'test',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_ANON_KEY: 'test-anon-key',
        TURNSTILE_SECRET_KEY: 'test-turnstile-key',
        ENCRYPTION_MASTER_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        // SERVICE_ROLE_KEY omitted - should fail
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('should be required in production', () => {
      const config = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'prod-anon-key',
        TURNSTILE_SECRET_KEY: 'prod-turnstile-key',
        ENCRYPTION_MASTER_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        // SERVICE_ROLE_KEY omitted - should fail
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('should be required in preview', () => {
      const config = {
        NODE_ENV: 'preview',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'preview-anon-key',
        TURNSTILE_SECRET_KEY: 'preview-turnstile-key',
        ENCRYPTION_MASTER_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        // SERVICE_ROLE_KEY omitted - should fail
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('should accept SERVICE_ROLE_KEY when provided', () => {
      const config = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'prod-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        TURNSTILE_SECRET_KEY: 'prod-turnstile-key',
        ENCRYPTION_MASTER_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('Required variables', () => {
    it('should require SUPABASE_URL', () => {
      const config = {
        NODE_ENV: 'development',
        SUPABASE_ANON_KEY: 'test-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        TURNSTILE_SECRET_KEY: 'test-turnstile-key',
        ENCRYPTION_MASTER_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_URL/);
    });

    it('should require SUPABASE_ANON_KEY', () => {
      const config = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        TURNSTILE_SECRET_KEY: 'test-turnstile-key',
        ENCRYPTION_MASTER_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_ANON_KEY/);
    });

    it('should require SUPABASE_SERVICE_ROLE_KEY', () => {
      const config = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_ANON_KEY: 'test-key',
        TURNSTILE_SECRET_KEY: 'test-turnstile-key',
        ENCRYPTION_MASTER_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('should require TURNSTILE_SECRET_KEY', () => {
      const config = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_ANON_KEY: 'test-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        ENCRYPTION_MASTER_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };

      expect(() => validateConfig(config)).toThrow(/TURNSTILE_SECRET_KEY/);
    });
  });

  describe('PostHog person deletion vars (optional)', () => {
    const baseConfig = {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'prod-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      TURNSTILE_SECRET_KEY: 'prod-turnstile-key',
      ENCRYPTION_MASTER_KEY:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };

    it('should accept all three PostHog vars when set', () => {
      const config = {
        ...baseConfig,
        POSTHOG_API_KEY: 'phx_xxx',
        POSTHOG_PROJECT_ID: '12345',
        POSTHOG_HOST: 'https://eu.posthog.com',
      };

      const result = validateConfig(config);

      expect(result.POSTHOG_API_KEY).toBe('phx_xxx');
      expect(result.POSTHOG_PROJECT_ID).toBe('12345');
      expect(result.POSTHOG_HOST).toBe('https://eu.posthog.com');
    });

    it('should parse successfully when all three PostHog vars are absent', () => {
      const result = validateConfig(baseConfig);

      expect(result.POSTHOG_API_KEY).toBeUndefined();
      expect(result.POSTHOG_PROJECT_ID).toBeUndefined();
      expect(result.POSTHOG_HOST).toBeUndefined();
    });

    it('should reject POSTHOG_HOST when not a valid URL', () => {
      const config = {
        ...baseConfig,
        POSTHOG_HOST: 'not-a-url',
      };

      expect(() => validateConfig(config)).toThrow(/POSTHOG_HOST/);
    });

    it('should reject POSTHOG_HOST with http:// scheme', () => {
      const config = {
        ...baseConfig,
        POSTHOG_HOST: 'http://eu.posthog.com',
      };

      expect(() => validateConfig(config)).toThrow(/POSTHOG_HOST/);
    });

    it('should reject POSTHOG_HOST with trailing slash', () => {
      const config = {
        ...baseConfig,
        POSTHOG_HOST: 'https://eu.posthog.com/',
      };

      expect(() => validateConfig(config)).toThrow(/POSTHOG_HOST/);
    });

    it('should reject POSTHOG_HOST with path', () => {
      const config = {
        ...baseConfig,
        POSTHOG_HOST: 'https://eu.posthog.com/api',
      };

      expect(() => validateConfig(config)).toThrow(/POSTHOG_HOST/);
    });

    it('should reject POSTHOG_PROJECT_ID when not numeric', () => {
      const config = {
        ...baseConfig,
        POSTHOG_API_KEY: 'phx_xxx',
        POSTHOG_PROJECT_ID: 'abc',
        POSTHOG_HOST: 'https://eu.posthog.com',
      };

      expect(() => validateConfig(config)).toThrow(/POSTHOG_PROJECT_ID/);
    });
  });

  describe('force-update vars defaults', () => {
    const baseConfig = {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'prod-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      TURNSTILE_SECRET_KEY: 'prod-turnstile-key',
      ENCRYPTION_MASTER_KEY:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };

    it('should apply default values when force-update vars are absent', () => {
      const result = validateConfig(baseConfig);

      expect(result.MIN_IOS_VERSION).toBe('1.0.0');
      expect(result.LATEST_IOS_VERSION).toBe('1.0.0');
      expect(result.IOS_STORE_URL).toBe(
        'https://apps.apple.com/app/id6758464920',
      );
      expect(result.MIN_WEB_VERSION).toBe('0.0.1');
      expect(result.LATEST_WEB_VERSION).toBe('0.0.1');
    });

    it('should use provided values over defaults when force-update vars are set', () => {
      const config = {
        ...baseConfig,
        MIN_IOS_VERSION: '2.1.0',
        LATEST_IOS_VERSION: '2.3.0',
        IOS_STORE_URL: 'https://apps.apple.com/app/id1234567890',
        MIN_WEB_VERSION: '1.5.0',
        LATEST_WEB_VERSION: '1.6.0',
      };

      const result = validateConfig(config);

      expect(result.MIN_IOS_VERSION).toBe('2.1.0');
      expect(result.LATEST_IOS_VERSION).toBe('2.3.0');
      expect(result.IOS_STORE_URL).toBe(
        'https://apps.apple.com/app/id1234567890',
      );
      expect(result.MIN_WEB_VERSION).toBe('1.5.0');
      expect(result.LATEST_WEB_VERSION).toBe('1.6.0');
    });

    it('should reject force-update version vars that are not semver', () => {
      const config = {
        ...baseConfig,
        MIN_IOS_VERSION: '1.0',
      };

      expect(() => validateConfig(config)).toThrow(/MIN_IOS_VERSION/);
    });
  });

  describe('Force-update version invariants (MIN <= LATEST)', () => {
    const baseConfig = {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'prod-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      TURNSTILE_SECRET_KEY: 'prod-turnstile-key',
      ENCRYPTION_MASTER_KEY:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };

    it('should accept iOS versions when MIN is below LATEST', () => {
      const config = {
        ...baseConfig,
        MIN_IOS_VERSION: '1.0.0',
        LATEST_IOS_VERSION: '1.0.2',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should accept versions when MIN equals LATEST', () => {
      const config = {
        ...baseConfig,
        MIN_IOS_VERSION: '2.1.0',
        LATEST_IOS_VERSION: '2.1.0',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject when MIN_IOS_VERSION is above LATEST_IOS_VERSION', () => {
      const config = {
        ...baseConfig,
        MIN_IOS_VERSION: '2.0.0',
        LATEST_IOS_VERSION: '0.1.0',
      };

      expect(() => validateConfig(config)).toThrow(/LATEST_IOS_VERSION/);
    });

    it('should reject when MIN_WEB_VERSION is above LATEST_WEB_VERSION', () => {
      const config = {
        ...baseConfig,
        MIN_WEB_VERSION: '3.0.0',
        LATEST_WEB_VERSION: '2.9.9',
      };

      expect(() => validateConfig(config)).toThrow(/LATEST_WEB_VERSION/);
    });

    it('should compare segments numerically (1.0.10 is above 1.0.2)', () => {
      const config = {
        ...baseConfig,
        MIN_IOS_VERSION: '1.0.2',
        LATEST_IOS_VERSION: '1.0.10',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });
  });
});
