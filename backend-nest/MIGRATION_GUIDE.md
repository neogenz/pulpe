# Backend Migration Guide: Module Architecture to Vertical Slice Architecture

This guide documents the migration from the traditional NestJS module architecture to the new Vertical Slice Architecture (VSA) in the Pulpe Budget API backend.

## Overview

The backend has been completely restructured from a module-based architecture to a domain-driven vertical slice architecture. This migration improves:

- **Maintainability**: Each slice is self-contained with clear boundaries
- **Testability**: Business logic is isolated from infrastructure concerns
- **Scalability**: New features can be added as independent slices
- **Type Safety**: Stronger compile-time and runtime validation

## Architecture Changes

### Old Structure (Module-based)
```
src/
├── modules/
│   ├── budget/
│   │   ├── budget.controller.ts
│   │   ├── budget.service.ts
│   │   ├── budget.module.ts
│   │   └── dto/
│   └── ...
```

### New Structure (Vertical Slice Architecture)
```
src/
├── slices/
│   ├── budgets/
│   │   ├── domain/           # Business logic
│   │   ├── application/      # Use cases (CQRS)
│   │   ├── infrastructure/   # External concerns
│   │   └── tests/           # All tests
│   └── ...
```

## API Endpoint Changes

All endpoints have been moved from v1 to v2 with improved structure:

### Authentication Endpoints
- `POST /auth/signup` → `POST /v2/auth/sign-up`
- `POST /auth/signin` → `POST /v2/auth/sign-in`
- `POST /auth/signout` → `POST /v2/auth/sign-out`
- `POST /auth/refresh` → `POST /v2/auth/refresh`
- `GET /auth/session` → `GET /v2/auth/session`

### Budget Endpoints
- `GET /budgets` → `GET /v2/budgets`
- `POST /budgets` → `POST /v2/budgets`
- `GET /budgets/:id` → `GET /v2/budgets/:id`
- `PUT /budgets/:id` → `PUT /v2/budgets/:id`
- `DELETE /budgets/:id` → `DELETE /v2/budgets/:id`
- `GET /budgets/period/:year/:month` → `GET /v2/budgets/by-period/:year/:month`

### Budget Template Endpoints
- `GET /budget-templates` → `GET /v2/budget-templates`
- `POST /budget-templates` → `POST /v2/budget-templates`
- `GET /budget-templates/:id` → `GET /v2/budget-templates/:id`
- `PUT /budget-templates/:id` → `PUT /v2/budget-templates/:id`
- `DELETE /budget-templates/:id` → `DELETE /v2/budget-templates/:id`
- `POST /budget-templates/:id/duplicate` → `POST /v2/budget-templates/:id/duplicate`

### Template Line Endpoints (New)
- `GET /v2/budget-templates/:templateId/lines`
- `POST /v2/budget-templates/:templateId/lines`
- `PUT /v2/budget-templates/:templateId/lines/:lineId`
- `DELETE /v2/budget-templates/:templateId/lines/:lineId`

### Budget Line Endpoints
- `GET /budget-lines` → `GET /v2/budget-lines`
- `POST /budget-lines` → `POST /v2/budget-lines`
- `GET /budget-lines/:id` → `GET /v2/budget-lines/:id`
- `PUT /budget-lines/:id` → `PUT /v2/budget-lines/:id`
- `DELETE /budget-lines/:id` → `DELETE /v2/budget-lines/:id`
- `POST /budget-lines/bulk` → `POST /v2/budget-lines/bulk-create`

### Transaction Endpoints
- `GET /transactions` → `GET /v2/transactions`
- `POST /transactions` → `POST /v2/transactions`
- `GET /transactions/:id` → `GET /v2/transactions/:id`
- `PUT /transactions/:id` → `PUT /v2/transactions/:id`
- `DELETE /transactions/:id` → `DELETE /v2/transactions/:id`
- `POST /transactions/bulk` → `POST /v2/transactions/bulk-import`

### User Endpoints
- `GET /users/me` → `GET /v2/users/current`
- `PUT /users/profile` → `PUT /v2/users/profile`
- `GET /users/onboarding` → `GET /v2/users/onboarding-status`
- `POST /users/onboarding/complete` → `POST /v2/users/complete-onboarding`

## Breaking Changes

### 1. Response Format Changes
All responses now follow a consistent structure with proper error handling:

**Old Error Response:**
```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "error": "Validation failed"
}
```

**New Error Response:**
```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": "Name is required"
  }
}
```

### 2. Authentication Changes
- JWT tokens are now validated using Supabase Auth
- All endpoints require Bearer token authentication
- Session management is handled by Supabase

### 3. Data Validation
- All requests are validated using Zod schemas
- Validation errors provide detailed field-level feedback
- Runtime type checking ensures data integrity

### 4. Database Access
- Direct database queries replaced with Repository pattern
- Row Level Security (RLS) enforced at database level
- All queries automatically filtered by authenticated user

## Migration Steps for Frontend

### 1. Update API Base URL
```typescript
// Old
const API_BASE = 'http://localhost:3000/api';

// New
const API_BASE = 'http://localhost:3000/api/v2';
```

### 2. Update Endpoint Paths
```typescript
// Old
async function getBudgets() {
  return fetch('/api/budgets');
}

// New
async function getBudgets() {
  return fetch('/api/v2/budgets');
}
```

### 3. Handle New Error Format
```typescript
// Old
if (response.status === 400) {
  const error = await response.json();
  console.error(error.message);
}

// New
if (!response.ok) {
  const { error } = await response.json();
  console.error(`${error.code}: ${error.message}`);
  if (error.details) {
    console.error('Details:', error.details);
  }
}
```

### 4. Update Authentication Headers
```typescript
// Same as before, but ensure token is from Supabase
const headers = {
  'Authorization': `Bearer ${supabaseSession.access_token}`,
  'Content-Type': 'application/json'
};
```

## New Features in v2

### 1. Enhanced Template Management
- Templates now support individual line management
- Lines can be added, updated, or removed independently
- Better support for template customization

### 2. Improved Error Handling
- Consistent error codes across all endpoints
- Detailed validation messages
- Better debugging information in development

### 3. Performance Improvements
- Optimized database queries
- Reduced N+1 query problems
- Better caching strategies

### 4. Enhanced Security
- Row Level Security (RLS) at database level
- Improved input validation
- Better protection against common vulnerabilities

## Testing the Migration

### 1. Health Check
```bash
curl http://localhost:3000/health
```

### 2. Test Authentication
```bash
# Sign up
curl -X POST http://localhost:3000/api/v2/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Sign in
curl -X POST http://localhost:3000/api/v2/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

### 3. Test Protected Endpoints
```bash
# Get budgets (requires auth token)
curl http://localhost:3000/api/v2/budgets \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Rollback Strategy

If issues arise with v2:

1. The v1 endpoints have been removed but can be restored from git history
2. Database schema remains unchanged, allowing for easy rollback
3. Frontend can switch back to v1 endpoints with URL change

## Support and Resources

- **Documentation**: Updated OpenAPI/Swagger docs at `/api/docs`
- **Type Definitions**: Shared types in `@pulpe/shared` package
- **Examples**: See `src/common/examples/` for usage patterns

## Future Considerations

The v2 architecture sets the foundation for:
- Event sourcing capabilities
- CQRS pattern implementation
- Microservices migration path
- Enhanced monitoring and observability

For questions or issues, please refer to the project documentation or contact the development team.