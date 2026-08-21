---
status: pending
---

# Instruction: Prove Android release-candidate readiness

## Architecture projection

```txt
.
├── .github/scripts/lexicon.test.mjs                 ✏️ enforce Android vocabulary in every catalog
├── android/maestro/{smoke,i18n}.yaml                ✏️ canonical French and locale-switch journeys
├── android/src/core/i18n/catalog-parity.spec.ts     ✏️ reject key/value drift and raw fallback output
├── android/docs-android/RELEASE.md                  ✏️ document locale-enabled native build requirement
└── android/app.json                                 ✏️ verify supported native locales
```

## User Journey

```mermaid
flowchart TD
  A[Install final Android candidate] --> B[Run canonical French smoke]
  B --> C[Switch EN DE IT]
  C --> D[Inspect representative auth budget goal template settings flows]
  D --> E[Restart and verify persistence]
  E --> F[Candidate is ready for PR validation]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Install clean candidate on narrow Android device => native locale metadata is active: 5: system
  section Happy path
    Run French smoke and locale journey => representative surfaces have no raw or mixed copy: 5: system
  section Edge case - German overflow
    Increase font scale on narrow width => primary actions remain visible and operable: 1: system
  section Teardown
    Restore French and clean test account => canonical baseline returns: 5: system
```

## Tasks to do

### `1)` Enforce static completeness

1. Reject missing, extra, blank, type-mismatched, or raw catalog output.
2. Extend the multilingual product lexicon gate to Android catalogs.

### `2)` Validate the candidate

1. Run Android quality, unit tests, export or native generation, canonical Maestro smoke, and locale journey on one exact head.
2. Inspect German narrow layout, restart and sign-out persistence, offline rollback, notification, and TalkBack labels.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Static gates fail on any catalog drift or banned product word in any Android locale.                                                 |
| 2    | Quality, tests, export or native generation, Maestro, persistence, rollback, German layout, and accessibility pass on one candidate. |
