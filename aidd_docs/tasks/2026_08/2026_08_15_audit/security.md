# Codebase Audit: i18n branch — security

Locale persistence is owner-scoped, allow-listed and least-privileged. The CodeQL dynamic-method finding in the iOS release feed is closed by runtime locale normalization and static title dispatch; privacy and CSP gates remain green.

- **Date**: 2026_08_15
- **Scope**: `origin/preview@07433bbe6...working tree` (feature tip `38ae006`, latest preview base and production-readiness commits)
- **Health**: good
- **Findings**: 0 critical, 0 warning, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |

## Top actions

1. Apply `20260815100000_create_user_locale_preference.sql` through the normal deployment workflow before deploying the backend that reads it.

## Coverage

- **Scanned**: security; SQL constraints, owner-only RLS, grants, authenticated upsert, legacy read-only backfill, secrets patterns, PostHog privacy, CodeQL source-to-sink review with a forged-locale regression test, CSP build and E2E checks
- **Skipped**: none
