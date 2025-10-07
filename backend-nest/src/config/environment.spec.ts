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
        // SERVICE_ROLE_KEY omitted - should fail
      };

      expect(() => validateConfig(config)).toThrow(
        /SUPABASE_SERVICE_ROLE_KEY.*Required/,
      );
    });

    it('should be required in test environment', () => {
      const config = {
        NODE_ENV: 'test',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_ANON_KEY: 'test-anon-key',
        TURNSTILE_SECRET_KEY: 'test-turnstile-key',
        // SERVICE_ROLE_KEY omitted - should fail
      };

      expect(() => validateConfig(config)).toThrow(
        /SUPABASE_SERVICE_ROLE_KEY.*Required/,
      );
    });

    it('should be required in production', () => {
      const config = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'prod-anon-key',
        TURNSTILE_SECRET_KEY: 'prod-turnstile-key',
        // SERVICE_ROLE_KEY omitted - should fail
      };

      expect(() => validateConfig(config)).toThrow(
        /SUPABASE_SERVICE_ROLE_KEY.*Required/,
      );
    });

    it('should be required in preview', () => {
      const config = {
        NODE_ENV: 'preview',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'preview-anon-key',
        TURNSTILE_SECRET_KEY: 'preview-turnstile-key',
        // SERVICE_ROLE_KEY omitted - should fail
      };

      expect(() => validateConfig(config)).toThrow(
        /SUPABASE_SERVICE_ROLE_KEY.*Required/,
      );
    });

    it('should accept SERVICE_ROLE_KEY when provided', () => {
      const config = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'prod-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        TURNSTILE_SECRET_KEY: 'prod-turnstile-key',
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
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_URL/);
    });

    it('should require SUPABASE_ANON_KEY', () => {
      const config = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        TURNSTILE_SECRET_KEY: 'test-turnstile-key',
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_ANON_KEY/);
    });

    it('should require SUPABASE_SERVICE_ROLE_KEY', () => {
      const config = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_ANON_KEY: 'test-key',
        TURNSTILE_SECRET_KEY: 'test-turnstile-key',
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('should require TURNSTILE_SECRET_KEY', () => {
      const config = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_ANON_KEY: 'test-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      };

      expect(() => validateConfig(config)).toThrow(/TURNSTILE_SECRET_KEY/);
    });
  });
});
