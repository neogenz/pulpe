# Review: Zod error code loss

- Rounds: 2
- Started: 2026-10-31

## Round 1 · r-d0db

- Date: 2026-10-31
- By: Maxime De Sogus
- Diff: `main...HEAD` plus the working tree
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 3/3 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] A Zod validation failure reaches the web client with its `code` — `backend-nest/src/common/filters/global-exception.filter.ts:183`, asserted against `errorResponseSchema` in `global-exception.filter.spec.ts:925`
- [x] HttpExceptions with an object body also answer a string `message` — `global-exception.filter.ts:248`
- [x] Tests cover the new response shape — `global-exception.filter.spec.ts:213-262`, `:300-320`, `:900-930`

### Findings

- `backend-nest/src/common/filters/global-exception.filter.ts:183` : the payload now decodes on iOS (`APIResponse.message: String?`) and Android (`errorResponseSchema`), and both show an unmapped code's `message` as-is. A Zod 400 used to fail decoding and fall back to localized French ("Quelque chose ne colle pas — vérifie ta saisie" on iOS, "Une erreur est survenue…" on Android); it will now show the English "Request validation failed", including on iOS builds already in the App Store → map `ERR_ZOD_VALIDATION_FAILED` to a localized validation error on iOS (`APIError.codeMapping`) and Android before shipping the backend change, or accept the English string on old builds — 🟡 major, fit
- `backend-nest/src/common/filters/global-exception.filter.ts:248` : same shift for Nest built-ins with an object body (demo `ForbiddenException`, route-not-found 404): iOS now gets `.serverError(message)` instead of `.forbidden`/`.notFound` → acceptable for the demo (French message), the 404 shows English "Cannot GET …" → covered by the same client decision — 🟢 minor, fit
- `backend-nest/src/common/filters/global-exception.filter.ts:180` : `as ZodError` where the TypeScript rule asks for a type guard (`.claude/rules/02-programming-languages/typescript.md`) → `instanceof ZodError`, keeping `details` only when it holds (applied after this round) — 🟢 minor, conform

## Round 2 · r-a24b

- Date: 2026-10-31
- By: Maxime De Sogus
- Diff: `main...HEAD` plus the working tree
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 4/4 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] A Zod validation failure reaches the web client with its `code` — `backend-nest/src/common/filters/global-exception.filter.ts:182`, asserted against `errorResponseSchema` in `global-exception.filter.spec.ts` (Full integration behavior)
- [x] HttpExceptions with an object body also answer a string `message` — `global-exception.filter.ts:250`
- [x] iOS and Android word `ERR_ZOD_VALIDATION_FAILED` and `HTTP_404` themselves instead of the English server text — `ios/Pulpe/Core/Network/APIError.swift` (`from`, `codeMapping`), `android/src/core/api/api-error.ts` (`TECHNICAL_CODE_MESSAGES_FR`)
- [x] Tests cover each side — backend filter spec 57/57, `APIErrorLocalizationTests.from_technicalBackendCodes_mapToLocalizedCases` (iOS target 2508 tests passed), Android `api-client.spec.ts` 16/16
