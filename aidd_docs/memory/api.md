# API

## Style
- NestJS REST controllers expose URI-versioned `/api/v1`; `/health` is unprefixed. Routes live under module `infrastructure/http/`.

## Resources
- Auth/demo, budgets/lines/templates, transactions/allocations, users/settings, encryption, currency, and app version.

## Contracts
- Global Zod request validation; shared wire schemas/error codes live in `pulpe-shared`, while RPC validation stays module-local.
- Errors are normalized by `global-exception.filter.ts`; success envelopes are mostly `{ success, data }` but not universal.
- Runtime Swagger is available outside production-like environments at `/docs`; no checked-in OpenAPI file.
- API timestamps are UTC instants. Calendar-only business dates use `formatBusinessCalendarDate` in `Europe/Zurich`; see `backend-nest/src/common/utils/business-calendar-date.ts`.
