# Architecture Decision Records (ADRs)

This is the project-wide decision log. ADRs explain durable technical choices and their
trade-offs; current inventories belong in code or living architecture documentation.

| #                                                            | Title                                  | Status   | One-liner                                                      |
| ------------------------------------------------------------ | -------------------------------------- | -------- | -------------------------------------------------------------- |
| [0001](0001-three-layer-clean-architecture.md)               | Three-layer Clean Architecture         | Accepted | domain / application / infrastructure per module               |
| [0002](0002-cross-module-via-ports-and-tokens.md)            | Cross-module via ports + tokens        | Accepted | Symbol tokens + interfaces, no direct service imports          |
| [0003](0003-use-case-single-execute-method.md)               | Use case = single `execute()`          | Accepted | one `@Injectable` per file, one verb per file                  |
| [0004](0004-repos-return-decrypted-entities.md)              | Repos return decrypted entities        | Accepted | repositories own the encryption boundary                       |
| [0005](0005-error-handling-business-exception.md)            | Error handling via `BusinessException` | Accepted | services throw, `GlobalExceptionFilter` is the only logger     |
| [0006](0006-cls-authenticated-supabase-provider.md)          | CLS-based authenticated Supabase       | Accepted | `AuthGuard` -> CLS -> `AuthenticatedSupabaseProvider`          |
| [0007](0007-zod-rpc-payload-schemas.md)                      | Zod RPC payload schemas                | Accepted | strict Zod for any RPC with JSONB ciphertexts                  |
| [0008](0008-encryption-service-decomposition.md)             | Encryption decomposition               | Accepted | primitives in `infrastructure/crypto/` + 8 use cases           |
| [0009](0009-dependency-cruiser-and-eslint-boundaries.md)     | Dual lint enforcement                  | Accepted | ESLint `boundaries` + `dependency-cruiser`                     |
| [0010](0010-deferred-decisions.md)                           | Deferred decisions                     | Accepted | what we explicitly did NOT build                               |
| [0011](0011-allocation-read-side-boundary.md)                | Allocation read-side boundary          | Accepted | prévu/réel relation endpoints live in `allocation`             |
| [0012](0012-split-key-financial-encryption.md)               | Split-key financial encryption         | Accepted | derive each user DEK from client and server factors            |
| [0013](0013-postgresql-rpcs-for-atomic-writes.md)            | PostgreSQL RPCs for atomic writes      | Accepted | keep multi-row financial invariants in one DB transaction      |
| [0014](0014-service-role-encryption-key-boundary.md)         | Service-role encryption-key boundary   | Accepted | no direct authenticated access to key metadata or rekey RPCs   |
| [0015](0015-defer-semantic-aad.md)                           | Defer semantic AAD                     | Accepted | accept same-user field relocation risk until reads fail closed |
| [0016](0016-mirror-interactive-formulas-typescript-swift.md) | Mirror interactive formulas            | Accepted | duplicate only formulas that must run under the user's finger  |
| [0017](0017-server-driven-minimum-version-gate.md)           | Server-driven minimum-version gate     | Accepted | clients fail open until the backend confirms a hard floor      |
| [0018](0018-android-with-expo-react-native.md)               | Android with Expo and React Native     | Proposed | reuse shared TypeScript contracts without a third formula port |
| [0019](0019-zod-diagnostics-and-tree-shakable-imports.md)    | Zod diagnostics and imports            | Accepted | keep technical errors English without unused locale bundles    |

## Conventions

- The decision, context, and consequences are immutable once Accepted. Status, cross-links,
  and clerical errors may be corrected. To revise a decision, write a new ADR that supersedes
  the old and mark the old `Status: Superseded by ADR-NNNN`.
- Numbering is sequential. Don't reuse retired numbers.
- Each ADR fits on one screen — if it doesn't, split.
- Status values: `Proposed` | `Accepted` | `Rejected` | `Deprecated` |
  `Superseded by ADR-NNNN`.
- Cross-link related ADRs at the bottom under "References".
- Reference real code paths (absolute from repo root) when claiming behavior.
- Lists of files, ports, or callers are snapshots at acceptance. Link to the current source of
  truth instead of maintaining a live inventory inside an accepted ADR.
