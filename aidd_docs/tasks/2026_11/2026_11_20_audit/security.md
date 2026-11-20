# Codebase Audit: security (PR #915, cbe305587..213322c41)

No new input path, no logging, amounts stay masked in the new a11y labels.

- **Date**: 2026_11_20
- **Scope**: diff of branch claude/android-home-hero-ios-parity-e3c75b against main, read with callers and neighbours
- **Health**: good
- **Findings**: 0 critical, 0 major, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |

No finding. Row and chart accessibility labels go through `formatCurrency`/`formatAdaptiveAmount`, which return the mask when amounts are hidden (`amount-format.ts`). The PIN progress label carries only the digit count. `AmountField` parsing is unchanged. No analytics event added.

## Top actions

1. None.

## Coverage

- **Scanned**: security (a11y labels vs amount masking, PIN label content, input parsing, logging, analytics payloads)
- **Skipped**: none
