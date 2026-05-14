# 0002 — Cross-module communication via ports and tokens

**Status:** Accepted
**Date:** 2026-05-08
**Deciders:** Pulpe team

## Context

Modules need to call each other. `budget-line` needs `budget` to recalculate balances. Most write use cases need encryption. `transaction` reads from `budget-line` references. Without a rule, this becomes a tangle of `import { SomeService } from '../other-module/...'`, which produces circular dependencies and makes testing hard.

We also want DI to be the only mechanism that wires modules — so test setups, demo mode, and future swaps stay localized.

## Decision

Modules expose Symbol tokens + TypeScript interface (a "port") in their `domain/ports/` folder. Consuming modules import only the token + interface and inject through `@Inject(TOKEN)`. Direct imports of another module's `*.service.ts` or `*.repository.ts` from outside that module are forbidden by `dependency-cruiser` (warn level, will tighten).

Active ports:

| Token | Owner module |
|-------|--------------|
| `BUDGET_REPOSITORY` | `budget` |
| `BUDGET_RECALCULATION_PORT` | `budget` |
| `BUDGET_LINE_REPOSITORY` | `budget-line` |
| `TRANSACTION_REPOSITORY` | `transaction` |
| `BUDGET_TEMPLATE_REPOSITORY` | `budget-template` |
| `ENCRYPTION_PORT` | `encryption` |
| `DEMO_CREDENTIALS_PORT` | `demo` |
| `DEMO_REPOSITORY` | `demo` |
| `USER_REPOSITORY` | `user` |
| `ACCOUNT_DELETION_REPOSITORY` | `account-deletion` |
| `ENCRYPTION_KEY_REPOSITORY` | `encryption` |

## Consequences

- Positive: zero circular imports; cross-module surface is explicit and minimal.
- Positive: tests substitute implementations via `{ provide: TOKEN, useValue: fake }` without monkey-patching.
- Negative: every cross-module call requires an extra interface file. Cost is small — most ports are short.
- Negative: tokens are nominal (Symbol), not structural — a typo on the token import is a runtime DI error, not a compile error. Mitigated by token re-exports in `<module>.tokens.ts`.

## Alternatives considered

- Direct `import { OtherService }`: rejected. Caused circular deps when modules grew (e.g., budget-line <-> transaction).
- String-token DI: rejected. Symbol tokens are unforgeable and don't collide.
- A central registry module: rejected as needless indirection.

## References

- `backend-nest/src/modules/budget-line/domain/ports/budget-line-repository.port.ts` — example
- `backend-nest/src/modules/encryption/domain/ports/encryption.port.ts`
- `backend-nest/.dependency-cruiser.cjs` — `no-cross-module-direct` rule
- ADR-0001, ADR-0009
