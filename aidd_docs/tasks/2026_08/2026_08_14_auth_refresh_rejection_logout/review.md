# Review: Auth refresh rejection returns to login

- **Verdict**: approve
- **Diff**: `a6695184d...working-tree (fix/auth-refresh-rejection-logout)`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_14
- **Findings**: 0 critical, 0 warning, 1 minor

## Phases

### Phase 1 — Classify refresh rejection in APIClient

- [x] Definitive 4xx refresh rejection surfaces `APIError.unauthorized` after `invalidateSession()` — `ios/Pulpe/Core/Network/APIClient.swift:337-340`, proven by `request_unauthorized_refreshRejectedWith4xx_invalidatesSessionAndThrowsUnauthorized` (passed)
- [x] URLError, 5xx auth response, and unconfirmed `sessionMissing` surface `APIError.networkError` with the session untouched — `ios/Pulpe/Core/Network/APIClient.swift:341` default path, proven by the three sibling tests (passed)
- [x] Four new tests execute and pass; pre-existing `request_unauthorized_refreshThrows_doesNotInvalidateSession` still passes — xcresult `Test-PulpeTests-2026.08.14_17-38-58`: 2221 passed, 0 failed, all 6 `request_unauthorized_*` tests listed

### Phase 2 — Local-build dead-server hint on NetworkUnavailableView

- [x] Preview/production copy byte-identical; hint gated on `AppConfiguration.environment == .local`; build and SwiftLint strict pass — `ios/Pulpe/Shared/Components/NetworkUnavailableView.swift:29-34`, swiftlint `--strict` exit 0

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | code | 1 | `ios/Pulpe/Core/Network/APIClient.swift:358` | Network layer now pattern-matches the Supabase SDK's `AuthError` shape directly (`import Supabase`) | Acceptable: the file already couples to `AuthService.shared` in its default closures; a typed classification error thrown by AuthService would be a larger diff for no behavior change |

## Verification

| Metric        | Value                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Verified      | 100% (4/4)                                                                                                         |
| Files checked | ios/Pulpe/Core/Network/APIClient.swift, ios/Pulpe/Shared/Components/NetworkUnavailableView.swift, ios/PulpeTests/Core/Network/APIClientClientKeyHeaderTests.swift |
| Unchecked     | none                                                                                                               |
| Unplanned     | Static helpers (`isTransientError`, `networkErrorDiagnostic`) relocated to a same-file `extension APIClient` to satisfy SwiftLint `type_body_length` strict — pure move, no behavior change |
