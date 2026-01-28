# CLAUDE.md - Frontend

## Commands

```bash
pnpm run dev                        # ng serve (http://localhost:4200)
pnpm run test                       # Vitest unit tests
pnpm run test -- path/to/spec.ts   # Single test file
pnpm run test:watch                 # Watch mode
pnpm run lint                       # BEFORE commit
```

**Angular CLI MCP**: Use when available for creating Angular artifacts.

## Stack

| Tech | Details |
|------|---------|
| Angular | 21+, standalone, OnPush |
| Styling | Tailwind v4 + Material 21 |
| State | Signals |
| Testing | Vitest + Playwright |

## Styling Quick Reference

- Mobile-first: `md:`, `lg:`, `xl:`
- Colors: `bg-primary`, `text-on-surface`
- Typography: `text-display-large`, `text-body-medium`
- **NEVER** `::ng-deep`

## Testing

See `.claude/rules/testing/vitest.md`

- `data-testid` naming: `feature-component-element` (e.g., `budget-form-submit-button`)
- Use `createMockResourceRef<T>()` for Resource mocks

## Critical Rules

- **NEVER** `::ng-deep`
- **NEVER** import between sibling features
- **ALWAYS** OnPush + signals
- **ALWAYS** `#fieldName` for private
- **BEFORE** creating: check `ui/` or `pattern/` first
