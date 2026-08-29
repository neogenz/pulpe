# Codebase Audit: android/ (security)

No exploitable hole found. The PIN never leaves the device, the vault cannot be overwritten from the client, backups and screenshots are off. Two decisions remain open: presumed diagnostics consent and no reaction to a dead session.

- **Date**: 2026-08-27
- **Scope**: `android/` (auth, vault, crypto, API client, observability, config, native plugins, CI workflows)
- **Health**: good
- **Findings**: 0 critical, 2 warning, 0 minor

## Findings

| Sev | Category | Location                                                   | Issue                                                                                                                                                                                                                                                                                                                  | Suggested fix                                                                                                                                                         | Effort |
| --- | -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | security | `android/src/core/api/api-client.ts:199-229`               | No 401/403 handling. A revoked or expired session (the webapp's global sign-out revokes it, cf. project memory) surfaces as per-screen "retry" placeholders until the Supabase refresh timer or an SDK auth event fires; the client keeps sending a dead JWT plus `X-Client-Key` meanwhile.                            | On 401 after one `refreshSession()` attempt, call `signOut({ scope: "local" })` so the user lands on sign-in instead of a retry loop; keep 403 as a normal API error. | M      |
| 🟡  | security | `android/src/core/observability/diagnostics-consent.ts:22` | Diagnostics sharing defaults to on (`storage.getBoolean(SHARING_KEY) !== false`): consent is presumed, not given. PostHog only runs in production builds and payloads are sanitized (`api-error-reporting.ts`), so the exposure is small, but it was flagged on 2026-08-21 and is still a presumption for CH/FR users. | Decide: default off until the user answers a first-run prompt, or document the opt-out choice and its legal basis in `docs-android/`.                                 | S      |

Verified and conformant (no row): HTTPS enforced except loopback in local builds (`core/config/env.ts`); `allowBackup: false` (`app.json:15`); `FLAG_SECURE` outside `__DEV__` (`core/system/privacy-shield.ts:22-23`); biometric key slot behind `requireAuthentication` (`core/crypto/client-key-manager.ts:74,105`); PBKDF2 on device, only `X-Client-Key` travels (`vault-store.ts:61-70`); the server refuses a second vault initialisation (`aes-gcm.crypto-service.ts createRecoveryKey` → `RECOVERY_KEY_ALREADY_EXISTS`; `initializeVaultIfEmpty` and `updateKeyCheckIfNull` write only where the column is null), so the mis-routed setup screen (see `architecture.md`) cannot rewrap or lose data; `validate-key` throttled 5/min server-side; `SYSTEM_ALERT_WINDOW` blocked by `plugins/with-release-permissions.js`; `signOut` scoped local; `openURL` only with `APP_URLS` or the backend's `storeUrl`; no secrets, `http://`, or `eval` in `src/`; CI actions SHA-pinned and Maestro verified by sha256 (`.github/workflows/android-e2e.yml:44-128`); `pnpm audit`: 0 advisories with a `pulpe-android` path.

## Top actions

1. Handle 401 in the API client (row 1). Hand off to `refactor` + `test`.
2. Take the diagnostics-consent decision (row 2); it is a one-line default either way.

## Coverage

- **Scanned**: security (OWASP MASVS storage/network/auth/crypto lenses, secrets grep, native permission plugins, EAS + GitHub workflows, backend encryption endpoints reached by the client)
- **Skipped**: runtime checks (no device or emulator attached: certificate pinning behaviour, keystore attestation, TalkBack leak of masked amounts) not exercised
