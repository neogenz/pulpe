# CLAUDE.md - Frontend

This file provides guidance to Claude Code (claude.ai/code) for the frontend application.

## Commands

```bash
pnpm run dev                        # ng serve (http://localhost:4200)
pnpm run test                       # Vitest unit tests
pnpm run test -- path/to/spec.ts   # Single test file
pnpm run test:watch                 # Watch mode
pnpm run lint                       # BEFORE commit
```

**Angular CLI MCP**: Use when available for creating Angular artifacts.

## Architecture

| Tech | Details |
|------|---------|
| Angular | 20+, standalone, OnPush |
| Styling | Tailwind v4 + Material v20 |
| State | Signals (see @STATE-PATTERN.md) |
| Testing | Vitest + Playwright |

## Directory Structure

```
projects/webapp/src/app/
├── core/      # Domain services (auth/, budget/, template/)
├── layout/    # App shell
├── ui/        # Stateless components
├── feature/   # Business domains (lazy-loaded, isolated)
└── pattern/   # Reusable stateful components
```

## Dependency Rules

```
core     ← layout, feature, pattern
ui       ← layout, feature, pattern
pattern  ← feature
feature  ← (isolated, NO sibling imports)
```

## Core Services

```
core/
├── auth/       # auth-api.ts, auth-guard.ts, auth-interceptor.ts
├── budget/     # budget-api.ts, budget-calculator.ts
├── template/   # template-api.ts
├── tutorial/   # tutorial.service.ts
├── analytics/  # posthog.ts
└── testing/    # createMockResourceRef
```

## Import Organization

```typescript
// 1. Angular core
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// 2. Angular ecosystem
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

// 3. Third-party
import { z } from 'zod';

// 4. Project aliases (@app, @core, @ui)
import { BudgetApiService } from '@core/budget';
import { ButtonComponent } from '@ui/button';

// 5. Relative imports (same feature only)
import { BudgetFormComponent } from './budget-form.component';
```

**Rules:**
- Use path aliases (`@core/`, `@ui/`) over deep relative paths
- Group imports with blank line between sections
- No barrel exports within features (avoid circular deps)

## Component Rules

- **OnPush**: `changeDetection: ChangeDetectionStrategy.OnPush`
- **Signals**: Prefer over observables
- **Private**: Use `#fieldName` syntax
- **State**: See @STATE-PATTERN.md

## Styling

- **NEVER** `::ng-deep`
- Material v20 + Tailwind v4
- Mobile-first: `md:`, `lg:`, `xl:`
- Colors: `bg-primary`, `text-on-surface`
- Typography: `text-display-large`, `text-body-medium`

## Material v20 Buttons

```html
matButton            <!-- text -->
matButton="filled"   <!-- primary action -->
matButton="outlined" <!-- secondary -->
matIconButton        <!-- icon only -->
```

## API Data Loading

Prefer `httpResource()` for API calls:

```typescript
readonly data = httpResource(() => `/api/endpoint/${this.id()}`);
```

Use `resource()` only for non-HTTP async operations.

## Error Handling

- Use `resource().error()` for async errors
- Display errors via Material snackbar
- Never silent-fail user actions
- Log errors to PostHog analytics

## Testing

See @.claude/rules/testing/vitest.md

- `data-testid` naming: `feature-component-element` (e.g., `budget-form-submit-button`)
- Use `createMockResourceRef<T>()` for Resource mocks

## Critical Rules

- **NEVER** `::ng-deep`
- **NEVER** import between sibling features
- **ALWAYS** OnPush + signals
- **ALWAYS** `#fieldName` for private
- **BEFORE** creating: check `ui/` or `pattern/` first

## Architecture References

| Topic | Reference |
|-------|-----------|
| Signal/Store | @frontend/STATE-PATTERN.md |
