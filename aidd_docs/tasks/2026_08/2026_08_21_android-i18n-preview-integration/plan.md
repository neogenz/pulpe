---
objective: "The Android app is merged with the current preview baseline and serves French, English, German, and Italian from the shared locale contract, with French as the fallback."
status: in-progress
---

# Plan: Integrate preview and localize Android

## Overview

| Field      | Value                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Merge `origin/preview` safely, then localize the complete Android user surface in `fr`, `en`, `de`, and `it` without changing currency formatting. |
| **Source** | User request from 2026-08-21, existing [`docs/I18N.md`](../../../../docs/I18N.md), and repository exploration.                                     |

The Android branch already contains one older merge from `preview`; it is now 146 commits ahead and 61 commits behind the common base. Rebase is deliberately rejected because it would rewrite a published, already-merged history. The first phase therefore merges the current `origin/preview` and resolves the 12 simulated conflict areas before any localization work.

Android gets its own catalogs because its screen structure and copy differ from the webapp and iOS. It reuses the shared locale codes, metadata, lexicon, API preference, and analytics contract. Amounts continue to follow the currency; dates and notification copy follow the interface language.

## Phases

| #   | Phase                                                         | File                         |
| --- | ------------------------------------------------------------- | ---------------------------- |
| 1   | Merge the current preview baseline                            | [`phase-1.md`](./phase-1.md) |
| 2   | Add the Android localization runtime                          | [`phase-2.md`](./phase-2.md) |
| 3   | Localize startup, auth, vault, onboarding, and settings       | [`phase-3.md`](./phase-3.md) |
| 4   | Localize the main shell, current month, budgets, and activity | [`phase-4.md`](./phase-4.md) |
| 5   | Localize savings goals, templates, tags, and account surfaces | [`phase-5.md`](./phase-5.md) |
| 6   | Localize formatters, notifications, and non-visual messages   | [`phase-6.md`](./phase-6.md) |
| 7   | Prove parity, layout resilience, and release readiness        | [`phase-7.md`](./phase-7.md) |

## Resources

| Source                                                  | Verified                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://docs.expo.dev/guides/localization/              | Expo recommends `expo-localization` for device locale detection, `i18n-js` as the minimal translation runtime, and declaring supported locales through the config plugin. |
| https://docs.expo.dev/versions/latest/sdk/localization/ | SDK 57 uses `expo-localization ~57.0.1`; `getLocales()`/`useLocales()` expose ordered Android language preferences.                                                       |
| https://github.com/fnando/i18n/blob/main/README.md      | `i18n-js` supports JSON catalogs, interpolation, plurals, a default locale, and fallback lookup.                                                                          |

## Decisions

| Decision                                                                                | Why                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merge `origin/preview`; do not rebase.                                                  | The branch is published, has 146 branch-side commits, and already contains a preview merge. Rebase would rewrite history for no product gain.                                                                                     |
| Use the already-installed `expo-localization` plus Expo's documented `i18n-js` runtime. | This is the smallest standard Expo setup; React updates are provided by the already-installed Zustand store rather than another provider dependency.                                                                              |
| Keep four Android-specific JSON catalogs with identical keys.                           | Reusing the 1,900-key web catalog would ship unrelated copy and still not cover Android-only screens. Catalog parity tests prevent drift.                                                                                         |
| Snapshot/device/server precedence mirrors iOS.                                          | A synchronous MMKV snapshot avoids a French first-frame flash; the server overrides it when present; otherwise a supported device language wins, then French. Sign-out clears the account snapshot before the next account loads. |
| Amount locale remains currency-owned; dates follow the selected language.               | This preserves Swiss grouping and the cross-platform contract in `docs/I18N.md`.                                                                                                                                                  |
