# Codebase Audit: Android — security

The security baseline is unusually solid for a young mobile client: keys use SecureStore, sensitive telemetry is scrubbed, screenshots are blocked in release and authenticated queries are vault-gated. A cold-start path nevertheless defeats the advertised five-minute app lock.

- Date: 2026-08-16
- Scope: authentication, vault, local storage, network configuration, deep links and observability
- Health: fair
- Findings: 1 critical, 2 warnings, 1 minor

## Findings

| Sev | Category | Location                                             | Issue                                                                                                                                                                                                                   | Suggested fix                                                                                                                                                                                    | Effort |
| --- | -------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 🔴  | Security | `android/src/core/vault/vault-store.ts:93`           | Bootstrap restores the standard client key and marks the vault unlocked. Because the background timestamp is only in memory, killing the process and reopening after five minutes bypasses the PIN/biometric auto-lock. | Persist the background timestamp and reject an expired restore before exposing the key, or stop persisting the ungated standard key across cold launches. Add one process-death regression test. | M      |
| 🟡  | Security | `android/src/features/onboarding/draft-storage.ts:9` | Income and expense estimates are intentionally stored as plaintext MMKV, while `android.allowBackup` is not disabled. Android backup can therefore copy this financial draft outside the app sandbox.                   | Set `android.allowBackup` to `false`; if backup is later required, explicitly exclude or device-encrypt this MMKV store.                                                                         | S      |
| 🟡  | Security | `android/src/core/config/env.ts:64`                  | Production API and Supabase URLs are only checked for presence. A bad EAS profile can ship `http://` and send bearer tokens/client keys without TLS.                                                                    | Parse URLs once and require `https:` outside local development, allowing only explicit loopback HTTP locally.                                                                                    | S      |
| 🟢  | Security | `android/src/core/linking/deep-links.ts:50`          | `decodeURIComponent` is called on untrusted external-link input without a guard; malformed percent encoding throws and can crash the router.                                                                            | Catch decode failures and reject the link, then validate the identifier with the existing schema/pattern.                                                                                        | S      |

## Top actions

1. Fix the cold-start vault bypass first with `codex-security:fix-finding`, including the process-death regression check.
2. Disable Android backup for the current server-authoritative app configuration.
3. Enforce HTTPS at environment parsing and make deep-link parsing non-throwing.

## Coverage

- Scanned: session lifecycle, PIN/biometric key slots, auto-lock, local persistence, API headers, EAS environments, Supabase configuration, telemetry scrubbing, screen capture and deep links.
- Verified externally: Expo/Android document `allowBackup` as enabled by default; MMKV documents plaintext storage without an encryption key.
- Skipped: dynamic penetration testing, rooted-device extraction and generated native-manifest inspection; no emulator/native project was supplied.
