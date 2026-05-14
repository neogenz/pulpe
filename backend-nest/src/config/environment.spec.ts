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
});
