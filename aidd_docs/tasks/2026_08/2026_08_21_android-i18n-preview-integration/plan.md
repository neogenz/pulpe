---
objective: "One reviewed Android integration PR is merged into preview with the complete FR/EN/DE/IT localization, green CI and Maestro checks, and every superseded Android draft closed without losing work."
status: in-progress
---

# Plan: Complete and consolidate Android localization

## Overview

| Field      | Value                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Finish Android FR/EN/DE/IT on one integration branch, prove it on the final head, then merge one PR into `preview`.                              |
| **Source** | User requests from 2026-08-21; Android PRs #608, #657, #659, #660, #661, #663, #664, #665, #666, #667; `docs/I18N.md`; current repository state. |

`origin/preview` is already an ancestor of the current integration branch: no preview commit is missing. Work therefore continues only on `codex/android-i18n-settings-preferences`; the stacked drafts are evidence sources, not merge units. Android keeps platform-specific catalogs while reusing the shared locale codes, metadata, lexicon, API preference, and analytics contract. Amounts remain currency-owned; dates and notification copy follow the interface language.

## Phases

| #   | Phase                                                    | File                           |
| --- | -------------------------------------------------------- | ------------------------------ |
| 1   | Merge the current preview baseline                       | [`phase-1.md`](./phase-1.md)   |
| 2   | Add the Android localization runtime                     | [`phase-2.md`](./phase-2.md)   |
| 3   | Localize startup, auth, vault, onboarding, and settings  | [`phase-3.md`](./phase-3.md)   |
| 4   | Finish the shell, current month, and budget overview     | [`phase-4.md`](./phase-4.md)   |
| 5   | Localize budget detail reading surfaces                  | [`phase-5.md`](./phase-5.md)   |
| 6   | Localize budget and activity mutations                   | [`phase-6.md`](./phase-6.md)   |
| 7   | Localize spread, postpone, point, and savings withdrawal | [`phase-7.md`](./phase-7.md)   |
| 8   | Localize savings-goal core journeys                      | [`phase-8.md`](./phase-8.md)   |
| 9   | Localize savings-goal planning and destructive journeys  | [`phase-9.md`](./phase-9.md)   |
| 10  | Localize templates and residual account surfaces         | [`phase-10.md`](./phase-10.md) |
| 11  | Close background, notification, and catalog gaps         | [`phase-11.md`](./phase-11.md) |
| 12  | Prove Android release-candidate readiness                | [`phase-12.md`](./phase-12.md) |
| 13  | Consolidate Android PRs and merge into preview           | [`phase-13.md`](./phase-13.md) |

## Resources

| Source                                                  | Verified                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://docs.expo.dev/guides/localization/              | Expo recommends `expo-localization` for device locale detection, `i18n-js` as the minimal translation runtime, and declaring supported locales through the config plugin. |
| https://docs.expo.dev/versions/latest/sdk/localization/ | SDK 57 uses `expo-localization ~57.0.1`; `getLocales()`/`useLocales()` expose ordered Android language preferences.                                                       |
| https://github.com/fnando/i18n/blob/main/README.md      | `i18n-js` supports JSON catalogs, interpolation, plurals, a default locale, and fallback lookup.                                                                          |

## Decisions

| Decision                                                                                | Why                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep the existing preview merge; do not rebase the published integration history.       | `origin/preview` is already an ancestor of the current head. Rewriting the stacked history would add risk without changing the final tree.                                                                                        |
| Use the already-installed `expo-localization` plus Expo's documented `i18n-js` runtime. | This is the smallest standard Expo setup; React updates are provided by the already-installed Zustand store rather than another provider dependency.                                                                              |
| Keep four Android-specific JSON catalogs with identical keys.                           | Reusing the 1,900-key web catalog would ship unrelated copy and still not cover Android-only screens. Catalog parity tests prevent drift.                                                                                         |
| Snapshot/device/server precedence mirrors iOS.                                          | A synchronous MMKV snapshot avoids a French first-frame flash; the server overrides it when present; otherwise a supported device language wins, then French. Sign-out clears the account snapshot before the next account loads. |
| Amount locale remains currency-owned; dates follow the selected language.               | This preserves Swiss grouping and the cross-platform contract in `docs/I18N.md`.                                                                                                                                                  |
| Ship through one final PR to `preview`; do not merge the stacked drafts.                | CI and review must evaluate one exact head. Each old Android PR is closed only after its head is proven included in the final merge.                                                                                              |
| Keep Google Play Console and production publication outside this plan.                  | This plan ends at a proven merge into `preview`; store configuration and rollout are tracked separately and must not distract the code integration.                                                                               |
