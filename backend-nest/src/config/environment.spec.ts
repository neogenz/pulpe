import { describe, expect, it } from 'bun:test';
import { validateConfig } from './environment';

describe('Environment Validation', () => {
  describe('SUPABASE_SERVICE_ROLE_KEY', () => {
    it('should be optional in development', () => {
      const config = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_ANON_KEY: 'test-anon-key',
        // SERVICE_ROLE_KEY omitted intentionally
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should be optional in test environment', () => {
      const config = {
        NODE_ENV: 'test',
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_ANON_KEY: 'test-anon-key',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should be required in production', () => {
      const config = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'prod-anon-key',
        // SERVICE_ROLE_KEY omitted - should fail
      };

      expect(() => validateConfig(config)).toThrow(
        /SUPABASE_SERVICE_ROLE_KEY is required in production\/preview environments/,
      );
    });

    it('should be required in preview', () => {
      const config = {
        NODE_ENV: 'preview',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'preview-anon-key',
      };

      expect(() => validateConfig(config)).toThrow(
        /SUPABASE_SERVICE_ROLE_KEY is required in production\/preview environments/,
      );
    });

    it('should accept SERVICE_ROLE_KEY in production when provided', () => {
      const config = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'prod-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('Required variables', () => {
    it('should require SUPABASE_URL', () => {
      const config = {
        NODE_ENV: 'development',
        SUPABASE_ANON_KEY: 'test-key',
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_URL/);
    });

    it('should require SUPABASE_ANON_KEY', () => {
      const config = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'http://localhost:54321',
      };

      expect(() => validateConfig(config)).toThrow(/SUPABASE_ANON_KEY/);
    });
  });
});
