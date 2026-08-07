# CLAUDE.md - Frontend

## Commands

```bash
pnpm run dev                        # ng serve (http://localhost:4200)
pnpm run test                       # Unit tests — `ng test`, AOT-compiled, Vitest runner
pnpm exec ng test --include "**/foo.spec.ts"   # Scoped run — `pnpm test -- …` does NOT pass through
pnpm run test:watch                 # Watch mode
```

Quality runs from the repo root (`pnpm quality`) — `pnpm run lint` alone is weaker than
what lefthook applies. Only `ng build` typechecks the templates.

**Angular CLI MCP**: Use when available for Angular artifacts.

## Stack

| Tech    | Details                                                                 |
| ------- | ----------------------------------------------------------------------- |
| Angular | 22+, standalone, OnPush                                                 |
| Styling | Tailwind v4 + Material 22                                               |
| State   | Signals                                                                 |
| Data    | `ngx-ziflux` — `cachedResource()` / `cachedMutation()` over `ApiClient` |
| Testing | Vitest + Playwright                                                     |

## Styling Quick Reference

- Mobile-first: `md:`, `lg:`, `xl:`
- Colors: `bg-primary`, `text-on-surface`
- Typography: `text-display-large`, `text-body-medium`
- **NEVER** `::ng-deep`

## Testing

See `.claude/rules/07-quality-assurance/testing-vitest.md`

- `data-testid`: kebab-case ending in the element's role — `-button`, `-input`, `-page`,
  `-dialog`. Prefix with the feature or component only where the role alone would collide;
  a fifth of the 447 ids in the app are two segments (`close-button`, `email-input`).
- Use `createMockDataCache()` for cache mocks — never hand-roll a `DataCache` double.

## Critical Rules

- **ALWAYS** `#fieldName` for private — **EXCEPT** `viewChild`/`viewChildren`/`contentChild`/`contentChildren`/`input`/`output`/`model` (NG1053: use `private`/`protected` instead, never `#`)
- **BEFORE** creating: check `ui/` or `pattern/` first
