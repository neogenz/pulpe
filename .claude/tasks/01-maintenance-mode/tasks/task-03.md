# Task: Frontend Maintenance Page

## Problem

Users redirected to maintenance mode need a clear, user-friendly page explaining that the application is temporarily unavailable. Currently no such page exists.

## Proposed Solution

Create a standalone maintenance page component with a simple, centered layout showing a maintenance icon, title, and message in French. Wire up the route configuration to make it accessible.

## Dependencies

- Task 2: Needs `ROUTES.MAINTENANCE` constant for route configuration

## Context

- Simple page pattern: `frontend/projects/webapp/src/app/feature/legal/terms-of-service/terms-of-service.ts`
- Route config pattern: `frontend/projects/webapp/src/app/feature/welcome/welcome.routes.ts`
- App routes: `frontend/projects/webapp/src/app/app.routes.ts`
- Design: Full-screen centered, Material card, maintenance icon

## Success Criteria

- Maintenance page component created at `feature/maintenance/`
- Page displays: icon, "Maintenance en cours" title, explanatory message
- Route `/maintenance` is accessible without authentication
- Page matches application visual style (Material, Tailwind)
- Optional: "Réessayer" button to reload the page
