import { Throttle, SkipThrottle as NestSkipThrottle } from '@nestjs/throttler';

/**
 * Skip rate limiting for this endpoint
 */
export const SkipThrottle = () => NestSkipThrottle();

/**
 * Apply strict rate limiting for auth endpoints
 * 5 requests per 5 minutes
 */
export const AuthRateLimit = () =>
  Throttle({ default: { limit: 5, ttl: 300000 } });

/**
 * Apply standard API rate limiting
 * 60 requests per minute
 */
export const ApiRateLimit = () =>
  Throttle({ default: { limit: 60, ttl: 60000 } });

/**
 * Apply custom rate limiting
 */
export const CustomRateLimit = (limit: number, ttl: number) =>
  Throttle({ default: { limit, ttl } });
