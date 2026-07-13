# Package

## Public API
- `pulpe-shared` is a local workspace-only ESM library. Its sole public entry is `shared/index.ts`; no subpath API is exposed.
- It exports Zod wire schemas/types, error/header/analytics constants, response factories, budget/period/spread formulas, and currency helpers.

## Consumers
- The project treats it as internal; in-repo consumers are Angular and NestJS through `workspace:*`, and no publish workflow is configured.

## Versioning
- Versioned with the product’s fixed Changesets group, not released independently. Relative ESM source imports retain `.js` suffixes.
