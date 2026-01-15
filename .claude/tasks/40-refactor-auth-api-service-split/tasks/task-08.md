# Task: Update Barrel Exports for New Auth Services

## Problem

The 6 new auth services need to be exported from the auth module's barrel file (`index.ts`) to make them available for import by consumers. This enables gradual migration from the facade pattern to direct service injection.

## Proposed Solution

Update the existing `index.ts` barrel file to export all 6 new services while maintaining all existing exports. This allows:
- Backward compatibility (AuthApi facade still exported)
- Future flexibility (consumers can gradually migrate to specific services)
- Clean import paths from `@core/auth`

## Dependencies

- **Task 7**: AuthApi facade refactor must be complete (ensures all services exist and work together)

## Context

**File to update:**
- `frontend/projects/webapp/src/app/core/auth/index.ts` (EXISTING file)

**New exports to add:**
```typescript
export * from './auth-state.service';
export * from './auth-session.service';
export * from './auth-credentials.service';
export * from './auth-oauth.service';
export * from './auth-demo.service';
export * from './auth-cleanup.service';
```

**Existing exports to keep:**
- `auth-api` (facade)
- `auth-guard`
- `auth-interceptor`
- All other existing exports

**Migration enablement:**
Consumers can now choose:
```typescript
// Old way (still works via facade)
import { AuthApi } from '@core/auth';

// New way (direct injection of specific services)
import { AuthStateService, AuthCredentialsService } from '@core/auth';
```

## Success Criteria

- [ ] `index.ts` updated with 6 new service exports
- [ ] All existing exports preserved
- [ ] New services importable from `@core/auth`
- [ ] No import errors in any consumer files
- [ ] Application builds successfully: `pnpm build`
- [ ] Application runs successfully: `pnpm dev`
- [ ] Full test suite passes: `pnpm test`
- [ ] E2E tests pass: `pnpm test:e2e`
