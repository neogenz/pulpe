---
description: "TypeScript strict typing and conventions"
paths:
  - "**/*.ts"
---

# TypeScript

`strict: true` in both `frontend/tsconfig.json` and `backend-nest/tsconfig.json`;
`@typescript-eslint/no-explicit-any` is `warn` in both (`off` in backend test files).
Standard TypeScript conventions apply as written — what follows is only the project's own
choices, where more than one convention would have been defensible.

| Element | Convention |
|---------|------------|
| Uncertain types | `unknown` over `any` |
| Type narrowing | Type guards over `as` assertions |
| Object shapes | `interface` |
| Unions/primitives | `type` |
| Optional fields | `timeout?: number`, never `timeout: number \| undefined` |
| Enumerations | String literal unions; plain `enum` if genuinely needed, never `const enum` |
| Generics | Single letter when simple (`T`), descriptive when not (`TInput`, `TOutput`) |

Frontend error reporting lives in `error-handling.md`; NestJS exception conventions live in
`error-handling-backend.md`. API-facing shapes come from Zod schemas in `shared/` and are
inferred, never hand-declared — see `shared-schemas.md`.
