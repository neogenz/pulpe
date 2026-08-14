---
objective: "A server-rejected refresh token returns the user to the login screen instead of trapping them on the network-error retry loop, while transient failures still never log anyone out."
status: reviewed
---

# Plan: Auth refresh rejection returns to login

## Overview

| Field      | Value                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Classify refresh-token failures in `APIClient.refreshTokenForRetry()` (definitive 4xx => logout, transient => retryable) and hint at the dead local server in Local builds |
| **Source** | Maxime's request: « 401 répété → retour au login au lieu de l'écran réseau; ECONNREFUSED → Serveur local éteint (build Local uniquement) », validated fix « Distinguer les cas dans l'app » |

## Phases

| #   | Phase                                                       | File                         |
| --- | ----------------------------------------------------------- | ---------------------------- |
| 1   | Classify refresh rejection in APIClient (volet B)           | [`phase-1.md`](./phase-1.md) |
| 2   | Local-build dead-server hint on NetworkUnavailableView (A)  | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision                                                                                                                                  | Why                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classify by HTTP status of `AuthError.api.underlyingResponse` (4xx minus 408/429 = definitive), not by GoTrue error codes                  | Status is robust to older/newer GoTrue payloads (e.g. `invalid_grant` without `error_code`); the SDK already maps the four terminal codes to `sessionMissing` + storage cleanup upstream, so any `.api` 4xx reaching us is a rejection outside that list |
| Unconfirmed `AuthError.sessionMissing` (rethrown by `forceRefreshAccessToken`) stays `.networkError`                                       | PUL-278: `AuthService.checkAndHandleConfirmedTerminalSessionFailure` deliberately refuses to confirm logout on keychain read failure or a valid persisted blob; overriding that here would reintroduce the self-inflicted daily logout          |
| Volet A gates on `AppConfiguration.environment == .local` only, not on `URLError.cannotConnectToHost`                                      | The URLError never reaches `NetworkUnavailableView` (`AppFlowState.networkUnavailable` carries only `retryable`); threading it through event, reducer, state, and route is ~30 LOC of plumbing for a dev-only cosmetic hint, while the env gate alone already guarantees zero user-facing change in preview/production |
