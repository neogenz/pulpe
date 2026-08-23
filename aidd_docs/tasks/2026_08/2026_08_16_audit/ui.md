# Codebase Audit: Android — UI/UX

The static UI is polished: French vocabulary is consistent, major lists have loading/error/empty states, touch targets and accessibility labels are generally deliberate, and feature code respects theme tokens. Some secondary-query failures are silently presented as valid empty data.

- Date: 2026-08-16
- Scope: route states, error recovery, accessibility, theme consistency and reduced motion
- Health: good
- Findings: 0 critical, 2 warnings, 1 minor

## Findings

| Sev | Category      | Location                                            | Issue                                                                                                                                                                                                                            | Suggested fix                                                                                                                          | Effort |
| --- | ------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | UI/UX         | `android/src/app/(main)/template/[id].tsx:95`       | A failed template-line query becomes an empty model via `lines.data ?? []`; a failed usage query becomes a propagation count of zero. The screen therefore presents an error as trustworthy data and can understate edit impact. | Branch on `isError`, show the existing retry/notice pattern, and do not enable propagation-sensitive edits until usage is known.       | S      |
| 🟡  | UI/UX         | `android/src/app/(main)/goal/[id].tsx:75`           | Loading waits for goal progress, but only missing goal data has an error gate; progress and secondary query errors silently remove projections, contributions or withdrawals.                                                    | Render one consolidated progress error with retry and non-blocking notices for optional panels, reusing existing placeholders/notices. | S      |
| 🟢  | Accessibility | `android/src/core/system/system-gate-screen.tsx:67` | The maintenance Lottie animation autoplays and loops regardless of the system's reduced-motion preference.                                                                                                                       | Read the native reduced-motion setting and show a static frame when enabled.                                                           | S      |

## Top actions

1. Distinguish loading, missing and failed secondary data on template and goal detail routes.
2. Respect reduced motion in the system gate and cover the branch with one focused check.

## Coverage

- Scanned: major routes, loading/error/empty states, mutation feedback, French product vocabulary, theme tokens, accessibility roles/labels, touch targets and animation usage.
- Confirmed: no broad hard-coded color or touch-target pattern was found in feature screens.
- Skipped: runtime TalkBack traversal, font scaling, contrast measurement and visual regression; no device/emulator session or screenshots were supplied.
