# CLAUDE.md - Frontend

Angular 22+, standalone, OnPush, Signals. Tailwind v4 + Material 22. Vitest + Playwright.
Data access goes through `ngx-ziflux` — `cachedResource()` / `cachedMutation()` over `ApiClient`.

Use the Angular CLI MCP when available for Angular artifacts.

## Commands

```bash
pnpm run dev        # ng serve (http://localhost:4200)
pnpm run test       # ng test — AOT-compiled, Vitest runner (test:watch for watch mode)
```

`pnpm run lint` alone is weaker than what lefthook applies; the real gate is `pnpm quality` at the repo root.

## Styling

- Colors: `bg-primary`, `text-on-surface` — Material tokens, never raw hex
- Typography: `text-display-large`, `text-body-medium`
- **NEVER** `::ng-deep`

## Testing

See `.claude/rules/07-quality-assurance/testing-vitest.md`

- `data-testid`: kebab-case ending in the element's role (`-button`, `-input`, `-page`, `-dialog`). Prefix with the feature only where the role alone would collide — most ids are two segments (`close-button`, `email-input`).
- Use `createMockDataCache()` for cache mocks — never hand-roll a `DataCache` double.

## Critical Rules

- **ALWAYS** `#fieldName` for private — **EXCEPT** `viewChild`/`viewChildren`/`contentChild`/`contentChildren`/`input`/`output`/`model` (NG1053: use `private`/`protected` instead, never `#`)
- **BEFORE** creating: check `ui/` or `pattern/` first
