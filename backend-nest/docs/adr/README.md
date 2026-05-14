# Architecture Decision Records (ADRs)

| # | Title | Status | One-liner |
|---|-------|--------|-----------|
| [0001](0001-three-layer-clean-architecture.md) | Three-layer Clean Architecture | Accepted | domain / application / infrastructure per module |
| [0002](0002-cross-module-via-ports-and-tokens.md) | Cross-module via ports + tokens | Accepted | Symbol tokens + interfaces, no direct service imports |
| [0003](0003-use-case-single-execute-method.md) | Use case = single `execute()` | Accepted | one `@Injectable` per file, one verb per file |
| [0004](0004-repos-return-decrypted-entities.md) | Repos return decrypted entities | Accepted | repositories own the encryption boundary |
| [0005](0005-error-handling-business-exception.md) | Error handling via `BusinessException` | Accepted | services throw, `GlobalExceptionFilter` is the only logger |
| [0006](0006-cls-authenticated-supabase-provider.md) | CLS-based authenticated Supabase | Accepted | `AuthGuard` -> CLS -> `AuthenticatedSupabaseProvider` |
| [0007](0007-zod-rpc-payload-schemas.md) | Zod RPC payload schemas | Accepted | strict Zod for any RPC with JSONB ciphertexts |
| [0008](0008-encryption-service-decomposition.md) | Encryption decomposition | Accepted | primitives in `infrastructure/crypto/` + 8 use cases |
| [0009](0009-dependency-cruiser-and-eslint-boundaries.md) | Dual lint enforcement | Accepted | ESLint `boundaries` + `dependency-cruiser` |
| [0010](0010-deferred-decisions.md) | Deferred decisions | Accepted | what we explicitly did NOT build |

## Conventions

- ADRs are immutable once Accepted. To revise, write a new ADR that supersedes the old (mark the old `Status: Superseded by ADR-NNNN`).
- Numbering is sequential. Don't reuse retired numbers.
- Each ADR fits on one screen — if it doesn't, split.
- Status values: `Accepted` | `Deprecated` | `Superseded by ADR-NNNN` | `Proposed` (open for discussion).
- Cross-link related ADRs at the bottom under "References".
- Reference real code paths (absolute from repo root) when claiming behavior.
