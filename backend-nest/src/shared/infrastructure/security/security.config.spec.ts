import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { SecurityConfig } from './security.config';

describe('SecurityConfig', () => {
  let securityConfig: SecurityConfig;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: mock((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          NODE_ENV: 'development',
          CORS_ORIGINS: 'http://localhost:4200,http://localhost:3000',
          RATE_LIMIT_TTL: 60000,
          RATE_LIMIT_MAX: 100,
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    securityConfig = new SecurityConfig(configService);
  });

  describe('getHelmetOptions', () => {
    it('should return development configuration', () => {
      // Act
      const options = securityConfig.getHelmetOptions();

      // Assert
      expect(options.contentSecurityPolicy).toBe(false);
      expect(options.crossOriginEmbedderPolicy).toBe(false);
      expect(options.hsts).toBe(false);
      expect(options.hidePoweredBy).toBe(true);
      expect(options.noSniff).toBe(true);
      expect(options.xssFilter).toBe(true);
    });

    it('should return production configuration', () => {
      // Arrange
      (configService.get as any).mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === 'NODE_ENV') return 'production';
          return defaultValue;
        },
      );

      // Act
      const options = securityConfig.getHelmetOptions();

      // Assert
      expect(options.contentSecurityPolicy).toBeDefined();
      expect(
        (options.contentSecurityPolicy as any).directives.defaultSrc,
      ).toEqual(["'self'"]);
      expect(options.crossOriginEmbedderPolicy).toBe(true);
      expect((options.hsts as any).maxAge).toBe(31536000);
      expect((options.hsts as any).includeSubDomains).toBe(true);
      expect((options.hsts as any).preload).toBe(true);
    });
  });

  describe('getCorsOptions', () => {
    it('should parse CORS origins correctly', () => {
      // Act
      const options = securityConfig.getCorsOptions();

      // Assert
      expect(options.credentials).toBe(true);
      expect(options.methods).toEqual([
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'OPTIONS',
      ]);
      expect(options.allowedHeaders).toEqual([
        'Content-Type',
        'Authorization',
        'X-Requested-With',
      ]);
      expect(options.exposedHeaders).toEqual(['X-Total-Count', 'X-Page-Count']);
      expect(options.maxAge).toBe(86400);
    });

    it('should handle origin validation correctly', () => {
      // Act
      const options = securityConfig.getCorsOptions();

      // Test allowed origin
      const callback1 = mock(() => {});
      options.origin('http://localhost:4200', callback1);
      expect(callback1).toHaveBeenCalledWith(null, true);

      // Test disallowed origin
      const callback2 = mock(() => {});
      options.origin('http://malicious.com', callback2);
      expect(callback2).toHaveBeenCalledWith(expect.any(Error));

      // Test no origin (mobile apps, Postman)
      const callback3 = mock(() => {});
      options.origin(undefined, callback3);
      expect(callback3).toHaveBeenCalledWith(null, true);
    });

    it('should handle single origin configuration', () => {
      // Arrange
      (configService.get as any).mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === 'CORS_ORIGINS') return 'http://localhost:4200';
          return defaultValue;
        },
      );

      // Act
      const options = securityConfig.getCorsOptions();
      const callback = mock(() => {});

      // Test
      options.origin('http://localhost:4200', callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });
  });

  describe('getRateLimitOptions', () => {
    it('should return default rate limit options', () => {
      // Act
      const options = securityConfig.getRateLimitOptions();

      // Assert
      expect(options.global).toEqual({
        ttl: 60000,
        limit: 100,
      });
      expect(options.auth).toEqual({
        ttl: 300000,
        limit: 5,
      });
      expect(options.api).toEqual({
        ttl: 60000,
        limit: 60,
      });
    });

    it('should use custom rate limit values from config', () => {
      // Arrange
      (configService.get as any).mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            RATE_LIMIT_TTL: 30000,
            RATE_LIMIT_MAX: 50,
          };
          return config[key] ?? defaultValue;
        },
      );

      // Act
      const options = securityConfig.getRateLimitOptions();

      // Assert
      expect(options.global).toEqual({
        ttl: 30000,
        limit: 50,
      });
    });
  });

  describe('getSecurityHeaders', () => {
    it('should return all security headers', () => {
      // Act
      const headers = securityConfig.getSecurityHeaders();

      // Assert
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Strict-Transport-Security']).toBe(
        'max-age=31536000; includeSubDomains',
      );
      expect(headers['X-Permitted-Cross-Domain-Policies']).toBe('none');
      expect(headers['Referrer-Policy']).toBe('no-referrer');
      expect(headers['Permissions-Policy']).toBe(
        'geolocation=(), microphone=(), camera=()',
      );
    });
  });
});
