# Security Module

This module provides comprehensive security features for the Pulpe Budget API, including authentication, authorization, rate limiting, and security headers.

## Features

### 1. Enhanced Authentication Guard
- **JWT Validation**: Validates tokens through Supabase Auth
- **User Context Injection**: Automatically injects authenticated user data into requests
- **Role-Based Access Control**: Support for role requirements on endpoints
- **Comprehensive Logging**: Structured logging for all auth events

### 2. Rate Limiting
- **Global Rate Limiting**: Default 100 requests per minute per IP+UserID
- **Auth-Specific Limits**: Stricter 5 requests per 5 minutes for auth endpoints
- **Custom Limits**: Configurable per-endpoint rate limits
- **Smart Tracking**: Combines IP address and user ID for accurate tracking

### 3. Security Headers (Helmet)
- **Content Security Policy**: Protects against XSS attacks
- **HSTS**: Enforces HTTPS connections in production
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Additional Headers**: Comprehensive security headers for defense in depth

### 4. CORS Configuration
- **Origin Validation**: Configurable allowed origins
- **Credentials Support**: Allows cookies and auth headers
- **Method Control**: Restricts allowed HTTP methods
- **Header Control**: Manages allowed request/response headers

## Usage

### Decorators

#### Authentication Decorators
```typescript
import { Public, Roles, RequireAdmin } from '@shared/infrastructure/security';

// Public endpoint - no authentication required
@Public()
@Get('health')
healthCheck() { }

// Requires specific roles
@Roles('admin', 'moderator')
@Get('admin-data')
getAdminData() { }

// Shorthand for admin role
@RequireAdmin()
@Delete('user/:id')
deleteUser() { }
```

#### Rate Limiting Decorators
```typescript
import { 
  SkipThrottle, 
  AuthRateLimit, 
  ApiRateLimit, 
  CustomRateLimit 
} from '@shared/infrastructure/security';

// Skip rate limiting
@SkipThrottle()
@Get('public-data')
getPublicData() { }

// Auth endpoints - 5 req/5 min
@AuthRateLimit()
@Post('login')
login() { }

// API endpoints - 60 req/min
@ApiRateLimit()
@Get('data')
getData() { }

// Custom limits
@CustomRateLimit(10, 60000) // 10 req/min
@Post('expensive-operation')
expensiveOperation() { }
```

### Configuration

Environment variables:
- `NODE_ENV`: Controls security strictness (development/production)
- `CORS_ORIGINS`: Comma-separated list of allowed origins
- `RATE_LIMIT_TTL`: Global rate limit window in ms (default: 60000)
- `RATE_LIMIT_MAX`: Global rate limit max requests (default: 100)

### Global Guards

The module automatically applies:
1. **EnhancedAuthGuard**: All endpoints require authentication unless marked with `@Public()`
2. **CustomThrottlerGuard**: All endpoints are rate-limited unless marked with `@SkipThrottle()`

### Security Headers

Helmet is configured with:
- Strict CSP in production, disabled in development
- HSTS with preload in production
- All recommended security headers
- Special handling for Swagger UI compatibility

## Testing

The module includes comprehensive test coverage:
- Unit tests for guards and configuration
- Integration tests for the complete security stack
- Mock utilities for testing protected endpoints

Run tests:
```bash
bun test src/shared/infrastructure/security
```

## Best Practices

1. **Always use decorators** instead of manual guard application
2. **Apply rate limiting** strategically based on endpoint sensitivity
3. **Use role-based access** for admin/privileged operations
4. **Monitor logs** for security events (auth failures, rate limit hits)
5. **Keep dependencies updated** for security patches

## Architecture

```
security/
├── enhanced-auth.guard.ts      # JWT validation & user context
├── custom-throttler.guard.ts   # Rate limiting implementation
├── security.config.ts          # Centralized security configuration
├── auth.decorators.ts          # Authentication decorators
├── throttler.decorators.ts     # Rate limiting decorators
├── security.module.ts          # Module configuration
└── *.spec.ts                  # Test files
```

## Logging

All security events are logged with structured data:
- **Auth Success**: User ID, path, method, duration
- **Auth Failure**: Reason, path, method, IP
- **Rate Limit Hit**: User ID, IP, path, method
- **Security Errors**: Full error context

Log levels:
- `info`: Successful authentications
- `warn`: Auth failures, rate limits, insufficient permissions
- `error`: Unexpected security errors