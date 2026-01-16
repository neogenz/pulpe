# Task: Backend Maintenance Mode Infrastructure

## Problem

We need the backend to block all API requests when maintenance mode is enabled via environment variable. Currently, there's no way to put the application into a maintenance state without fully stopping it.

## Proposed Solution

Implement a NestJS middleware that checks the `MAINTENANCE_MODE` environment variable and returns 503 for all requests when enabled. Health endpoints must remain accessible for Railway health checks. Also add a public status endpoint that the frontend can check on startup.

## Dependencies

- None (can start immediately)

## Context

- Environment config pattern: `backend-nest/src/config/environment.ts`
- Existing middleware example: `backend-nest/src/common/middleware/payload-size.middleware.ts`
- Health endpoints location: `backend-nest/src/main.ts:141-150`
- Middleware registration: `backend-nest/src/app.module.ts:293-296`

## Success Criteria

- `MAINTENANCE_MODE=true` returns 503 with code `MAINTENANCE` for all API routes
- `/health` and `/` endpoints still return 200 when in maintenance
- `/api/v1/maintenance/status` endpoint returns maintenance state
- `MAINTENANCE_MODE=false` or unset allows normal operation
