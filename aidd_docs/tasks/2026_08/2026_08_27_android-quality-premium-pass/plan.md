---
objective: "Every finding of the 2026-08-27 Android audit is closed and the app reads as a clean, premium Material 3 app on its shell, home and forms."
status: implemented
---

# Plan: Android quality and premium pass

## Overview

| Field      | Value                                                                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Fix the PIN re-setup regression and the 27 other audit findings, then rebuild the shell, the home and the form modal in the Android idiom without adding a UI kit.                                                                                       |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_27_audit/report.md` and its seven pillar files; user request "fait un plan pour tout corriger et améliorer le visuel rendu aussi, comme une app android quali, premium et propre"; `DESIGN.md` and `android/DESIGN.md`. |

## Phases

| #   | Phase                                                  | File                           |
| --- | ------------------------------------------------------ | ------------------------------ |
| 1   | Vault routing decider (PIN regression)                 | [`phase-1.md`](./phase-1.md)   |
| 2   | Toolchain and dependency alignment                     | [`phase-2.md`](./phase-2.md)   |
| 3   | Housekeeping and records                               | [`phase-3.md`](./phase-3.md)   |
| 4   | Dead session handling and diagnostics consent          | [`phase-4.md`](./phase-4.md)   |
| 5   | Targeted query invalidation                            | [`phase-5.md`](./phase-5.md)   |
| 6   | Material 3 shell: navigation bar and top app bar       | [`phase-6.md`](./phase-6.md)   |
| 7   | Home hero: chart captions, next-month action, skeleton | [`phase-7.md`](./phase-7.md)   |
| 8   | Home content zone: one tonal card, list rows           | [`phase-8.md`](./phase-8.md)   |
| 9   | Bottom-anchored form modal                             | [`phase-9.md`](./phase-9.md)   |
| 10  | Rendering tests and CI vault flow                      | [`phase-10.md`](./phase-10.md) |

Phases 1 to 5 close the functional findings and ship independently, in order. Phases 6 to 9 are the visual pass; 7 and 8 depend on 6, and 9 stands alone. Phase 10 closes the test findings and depends on 1 (routing) and 9 (sheet spec).

## Resources

| Source                                                                                              | Verified                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://callstack.github.io/react-native-paper/docs/components/BottomNavigation/BottomNavigationBar | `BottomNavigation.Bar` props (`navigationState`, `onTabPress`, `renderIcon`, `getLabelText`, `safeAreaInsets`, `activeIndicatorStyle`) match the installed `BottomNavigationBar.d.ts`; documented react-navigation `tabBar` usage. |
| https://callstack.github.io/react-native-paper/docs/components/Appbar/AppbarHeader                  | `Appbar.Header` `mode` values (`small`, `medium`, `large`, `center-aligned`) and `elevated` match the installed `AppbarHeader.d.ts`.                                                                                               |
| https://docs.expo.dev/router/reference/testing/                                                     | `renderRouter(context, { initialUrl })` from `expo-router/testing-library` exists in the installed expo-router 57.0.16 (`build/testing-library/index.js`).                                                                         |
| https://m3.material.io/components/navigation-bar/specs                                              | 80 dp bar, active indicator pill in `secondaryContainer`, `labelMedium` labels, filled icon when active.                                                                                                                           |
| https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation                    | `invalidateQueries({ queryKey, refetchType: "none" })` marks stale without refetching; `refetchQueries({ stale: true })` refetches only stale matches.                                                                             |
| https://docs.maestro.dev/api-reference/commands/launchapp                                           | `launchApp` accepts `stopApp: false`; to confirm at execution together with `pressKey: Home` before scripting the resume step of phase 10.                                                                                         |
| https://beui.dev/ and https://coss.com/ui/docs                                                      | Both are DOM-only (React + Tailwind); neither runs in React Native. Settled the "no new UI kit" decision.                                                                                                                          |

## Decisions

| Decision                                                                                                                                                       | Why                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index` is declared first in the root `Stack` and stays the only routing decider; no group relies on react-navigation's fallback.                              | A guard flip is resolved by `StackRouter.getStateForRouteNamesChange` (`initialRouteName ?? routeNames[0]`), not by `landingRoute`. Putting `index` first makes every flip land on the decider; per-group defaults would be a second, silent decider.                                                            |
| No new UI kit (beUI, coss ui, NativeWind ports). `react-native-paper` stays the kit, Pulpe signatures stay in `src/ui` and `features/*/components`.            | The audit found a composition problem, not a missing widget: every piece the target needs ships in Paper. A third visual language breaks the kit/signature split in `android/DESIGN.md` and the Two-Family Rule.                                                                                                 |
| Forms open in a bottom-anchored `FormModal` (native `Modal`, slide, top radii); still no drag handle, no swipe dismissal, no `@gorhom/bottom-sheet`.           | Bottom anchoring fixes the "iOS alert with a keyboard" reading at zero dependency cost and keeps the keyboard-inset math. A handle promises a gesture the modal does not have; a full sheet library adds a native dependency and a 17-form migration for no product gain.                                        |
| Diagnostics sharing stays on by default (informed opt-out), documented in `android/docs-android/ANALYTICS.md`.                                                 | The consent flag drives `optIn`/`optOut` on the whole PostHog SDK, so an opt-in default would silence the product funnels the retention work depends on for every user who never opens Preferences. The toggle, the sanitizer and the production-only gate stay; the legal basis line is the owner's to confirm. |
| No `max-lines` lint rule. `home.tsx` shrinks through phases 6 to 8; the two detail screens are left as they are.                                               | A ceiling would fail twelve files at once and force splits with no behaviour gain; the files that matter for this pass get smaller by design, not by rule.                                                                                                                                                       |
| Expo-governed packages follow `expo install --fix`; `zod` is pinned to the version resolved for `pulpe-shared` so one copy is bundled; no workspace-wide bump. | `pnpm deps:check` is the contract in `docs-android/DEPENDENCIES.md`. A zod range change touches `shared`, `frontend` and `backend-nest` and requires the Angular bundle re-measure (`CLAUDE.md`), which is not this plan's scope.                                                                                |
| A mutation invalidates its own budget's detail actively and marks the budget list stale without refetching; only budget create/delete keep the prefix sweep.   | Bottom tabs stay mounted, so a prefix invalidation refetches the list, the periods and every visited detail after one pointing tap. Stale-only plus refetch-on-focus keeps every screen correct at a fraction of the traffic.                                                                                    |
