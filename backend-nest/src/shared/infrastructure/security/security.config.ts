import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HelmetOptions } from 'helmet';

@Injectable()
export class SecurityConfig {
  constructor(private readonly configService: ConfigService) {}

  getHelmetOptions(): HelmetOptions {
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';

    return {
      contentSecurityPolicy: isDevelopment
        ? false // Disable CSP in development for easier debugging
        : {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Swagger UI
              scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for Swagger UI
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
            },
          },
      crossOriginEmbedderPolicy: !isDevelopment,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: isDevelopment
        ? false
        : {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: 'no-referrer' },
      xssFilter: true,
    };
  }

  getCorsOptions() {
    const allowedOrigins = this.configService
      .get<string>('CORS_ORIGINS', 'http://localhost:4200')
      .split(',')
      .map((origin) => origin.trim());

    return {
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 86400, // 24 hours
    };
  }

  getRateLimitOptions() {
    return {
      // Global rate limit
      global: {
        ttl: this.configService.get<number>('RATE_LIMIT_TTL', 60000), // 1 minute
        limit: this.configService.get<number>('RATE_LIMIT_MAX', 100), // 100 requests per minute
      },
      // Auth endpoints - more restrictive
      auth: {
        ttl: 300000, // 5 minutes
        limit: 5, // 5 attempts per 5 minutes
      },
      // API endpoints - standard limits
      api: {
        ttl: 60000, // 1 minute
        limit: 60, // 60 requests per minute
      },
    };
  }

  getSecurityHeaders() {
    return {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Permitted-Cross-Domain-Policies': 'none',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };
  }
}
