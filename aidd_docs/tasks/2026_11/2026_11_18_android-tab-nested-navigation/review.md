# Review: Android per-tab nested navigation

## Round 1

- Diff: `origin/main...5c5a85e1b` (merge base `0cd3eb7fc`, 3 commits)
- Uncommitted changes: no (only this untracked plan folder)
- Axes: code, functional, relevancy
- Verdict: changes-requested, because two major findings (a month deleted from another tab leaves Budgets with a stale history; a link arriving on a root-stack form mints a second tabs navigator) and the phase-3 task-1 criterion is unmet

### Criteria

- [x] Phase 1 / 1: `tab_switched` carries `home`/`budgets`/`goals`/`templates`/`net-worth` for both trees, fires only on a tab change, testIDs unchanged — `android/src/core/navigation/tab-route.ts:19-23`, `android/src/app/(main)/(tabs)/_layout.tsx:37-52`, `android/src/core/ui/navigation-bar.tsx:64,79`, `tab-route.spec.ts:11-26`, `tab-stacks.spec.tsx` presses `tab-home`/`tab-budgets` on `(home)`/`(budgets)` routes
- [x] Phase 1 / 2: screen name from the phase-2 segments equals today's — `android/src/core/observability/analytics.ts:186`, `tab-route.ts:31-44`, `tab-route.spec.ts:28-51`
- [x] Phase 2 / 3 (static half): no file under `/(tabs)/` declares a bottom edge, `[lineId]` FAB no longer adds `insets.bottom` — `[lineId].tsx:419,464`, grep of `edges=`/`insets.bottom` under `app/(main)/(tabs)`
- [ ] Phase 3 / 1: deep link, creation, deletion and planning each land in the right tab with a back path that ends on a tab root — deletion from another tab leaves Budgets' pushed screens under a second list (finding 1); a link arriving on a root-stack form opens a second tabs navigator (finding 2)
- Unverified at runtime: Phase 2 / 1 (bar visible with its tab active on every moved screen; mask toggle keeps every stack) — an on-device pass would show it; the code wraps screens, never a navigator (`(home,budgets,goals,templates)/_layout.tsx:399-405`, `(tabs)/_layout.tsx:737-743`, `(main)/_layout.tsx:30-36`)
- Unverified at runtime: Phase 2 / 2 (`pnpm test`, `pnpm quality` pass; every target resolves) — not run on this head; target resolution traced in code and in `tab-stacks.spec.tsx`
- Unverified at runtime: Phase 2 / 3 (no blank band above the bar on the emulator)
- Unverified at runtime: Phase 3 / 2 (emulator scenarios, Maestro, `pnpm test`, `pnpm quality`) — device pass in progress separately

### Assumptions

- `(home,budgets,goals,templates)` expands to one layout per tab and an in-app `push("/budget/…")` stays in the focused tab — holds, checked at `tab-stacks.spec.tsx` ("a month opened from %s stays in that tab", real router) and `node_modules/expo-router/build/getRoutesCore.js:641-675`
- `unstable_settings` keys are the bare group names — holds, `matchLastGroupName` strips the parentheses at `node_modules/expo-router/build/matchers.js:44-46`; the anchors equal the default (child named like the group, `getRoutesCore.js:647-650`)
- `useNavigation().getState()` in `budget/create` is the `(main)` stack state with `(tabs).state` nested — holds, checked at `tab-stacks.spec.tsx` `CreateForm` mounted at `(main)/budget/create`
- `router.back()` then `router.push()` run in order and the push is computed after the back — holds, `node_modules/expo-router/build/global-state/routingQueue.js:24-45` resolves `ROUTER_LINK` at run time, after the queued `GO_BACK`
- `router.navigate("/budgets")` lands on the Budgets list whatever that tab holds — finding 1, checked at `node_modules/expo-router/build/layouts/StackClient.js:96-104`
- A `budget` link is only followed while a tab is focused — finding 2, checked at `node_modules/expo-router/build/global-state/stateUtils.js:60-66` and `StackClient.js:82-113`

### Findings

- `android/src/features/budgets/month-navigation.ts:29` : a month deleted from Accueil or Objectifs while Budgets holds any pushed screen (`[budgets, X]`) ends as `[budgets, X, budgets?deletedMonth]`: the nested `navigate` to `budgets` carries no `pop`, so the stack reuses only the current route and pushes a new list; back from « Mois supprimé » then shows X (possibly the deleted month), then the list again. The comment's « no page of the month stays behind » holds only for the tab the deletion ran in, proof `node_modules/expo-router/build/layouts/StackClient.js:96-104`, `node_modules/expo-router/build/react-navigation/core/useNavigationBuilder.js:427-433`; `tab-stacks.spec.tsx` only deletes with Budgets at its root → also pop the Budgets stack to its root before landing there (for instance a `StackActions.popToTop()` targeted at the `(budgets)` stack key read from the root state), so the `deletedMonth` navigate hits the same-name root route and only updates its params (`StackClient.js:99`), plus a spec deleting from `/home` with `/budget/other` pushed in Budgets — 🟡 major
- `android/src/core/linking/deep-link-router.tsx:48` : a `pulpe://budget?id=` link followed while `budget/create`, `budget/plan` or `post-onboarding` is focused diverges at the `(main)` stack and `PUSH`es a route named `(tabs)`; with no `getId` the stack appends a new one, so a second tabs navigator opens over the form (the old `/budget/<id>` push stayed on the same stack), proof `node_modules/expo-router/build/global-state/stateUtils.js:60-66`, `node_modules/expo-router/build/layouts/StackClient.js:82-113` → when no tab is focused (`tabGroupUnder(navigationRef.getRootState()…)` / `currentTab(segments)` undefined), close the root-stack screen first as `useOpenMonthInOpeningTab` does (`router.back()` / `router.dismissAll()`), then push; add a `tab-stacks.spec.tsx` case with the link arriving on `/budget/create` — 🟡 major
- `android/src/core/linking/deep-link-router.tsx:48` : the Budgets stack is not reset before the month is pushed, unlike iOS `openBudgetMonth` (`resetBudgetStack()`, `ios/Pulpe/App/AppState+Navigation.swift:62-63`) that the plan's Decisions row claims to match: with Budgets at `[budgets, Y, line L]`, back from the linked month goes to line L, proof `StackClient.js:96-104` (no same-name current route, so a push) → pop the Budgets stack to its root before pushing (same mechanism as finding 1), or state the deviation in the plan — 🟢 minor
- `android/src/app/(main)/(tabs)/(home,budgets,goals,templates)/budget/[id]/line/[lineId].tsx:416-417` : the comment still says the FAB needs the inset to clear the gesture bar, while the line now uses `styles.fab` with no inset (the tab bar pays it), proof `[lineId].tsx:419,464` → drop or rewrite the comment (« the tab bar below pays the bottom inset ») — 🟢 minor
- `android/docs-android/ANALYTICS.md:43` : still points at `src/app/(main)/settings/preferences.tsx`, a path this diff moved to `src/app/(main)/(tabs)/(home)/settings/preferences.tsx`, proof `git diff --stat origin/main...HEAD` rename → update the path — 🟢 minor

### Limits

- Creating a month from Accueil (« Préparer le mois suivant », « Autre modèle ») now pushes it on the Accueil stack; iOS stays on Accueil and refreshes it (`ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:68-72,125-136`). Android already opened the month before this diff (`router.replace`), and phase-3 Test Scope asks for it — product call, not a regression.
- The `(tabs)/_layout.tsx:42` flag redirect `router.replace("/home")` targets the tabs navigator with `REPLACE`; behaviour is the same before and after the rename, not re-verified here — an on-device run with `net_worth` turned off would settle it.
- Re-tap pop-to-top and stack retention across switches rest on `tab-stacks.spec.tsx` with a stubbed layout event; only the device pass settles them on Paper's real bar.
- Specs and `pnpm quality` were not run in this review (read-only); proofs are from the source and the installed `expo-router@57.0.31`.

## Round 2

- Diff: `origin/main...a57afaa01` (code identical to `d245e6eae`; the last commit only adds the task docs)
- Uncommitted changes: no
- Axes: code, functional, relevancy
- Verdict: changes-requested, because one major finding (the Accueil « Objectifs » shortcut stacks a second goals list over a goal left open in Objectifs) and the phase-3 task-2 criterion is unchecked (Maestro not run, deletion and link not observed on the emulator)

### Criteria

- [x] Phase 1 / 1: `tab_switched` per tab, only on a change, testIDs unchanged — `android/src/core/navigation/tab-route.ts:22-26`, `android/src/app/(main)/(tabs)/_layout.tsx:38-53`, `android/src/core/ui/navigation-bar.tsx:64,79`, `tab-stacks.spec.tsx` presses `tab-home`/`tab-budgets` on `(home)`/`(budgets)`
- [x] Phase 1 / 2: screen names unchanged — `tab-route.ts:34-47`, table at `tab-route.spec.ts:31-50`
- [x] Phase 2 / 1: bar visible with its tab active, mask toggle keeps every stack — Run 1 on `d245e6eae` (observed on `pulpe_light`); the boundary wraps screens only, `(home,budgets,goals,templates)/_layout.tsx:35-41`, `(tabs)/_layout.tsx:67-73`, `(main)/_layout.tsx:32-38`
- [x] Phase 2 / 2: every push/replace/dismissTo target resolves; tests and quality green — every call site traced (all `/budget/…` and `/goal/…` pushes come from screens inside the array group, `/settings*`, `/movements`, `/to-point` only from `(home)`, `/template/…` only from `(templates)`); Run 1: 205 suites / 1337 tests, `pnpm quality`
- [x] Phase 2 / 3: no bottom inset under `(tabs)` — `screen-insets.spec.ts:75-84`, grep of `edges=`/`insets.bottom` (only `edges={["top"]}` left under `(tabs)`), Run 1 emulator
- [x] Phase 3 / 1: link, creation, deletion and planning land in the right tab with a back path ending on a tab root — `android/src/features/budgets/month-navigation.ts:16-53`, `tab-stacks.spec.tsx:204-299`
- [ ] Phase 3 / 2: every scenario observed on the emulator, Maestro green — Run 1: Maestro not run, deletion not exercised on device, the `pulpe://budget?id=` row shows « Unmatched Route »

### Assumptions

- A `popToTop` with `target` reaches a tab's stack that is not focused — holds, `node_modules/expo-router/build/react-navigation/core/useOnAction.js:67-71`, and `tab-stacks.spec.tsx:257-275` pops `(budgets)` from `(home)`
- The bar's `navigation.navigate(route.name, route.params)` does not replay a consumed nested navigation — holds while no tab screen has `initialParams`: `TabRouter.js:228` then keeps the same params object, marked consumed at `useNavigationBuilder.js:215-216,457`
- A cross-tab `push` to a tab root lands on that root — finding, `node_modules/expo-router/build/global-state/getNavigationAction.js:48-50,93-101` (PUSH turns into NAVIGATE on the tabs, no `pop` in the payload), `react-navigation/routers/StackRouter.js:188-197`
- Run 1 evidence applies to this head — holds, `git diff d245e6eae a57afaa01` touches only the task folder

### Findings

- `android/src/app/(main)/(tabs)/(home)/home.tsx:505` : `push("/goals")` while Objectifs still holds a goal (`[goals, goal/[id]]`, kept across the switch on purpose) reaches the `(goals)` stack as a nested `navigate("goals")` with no `pop`; the current route is `goal/[id]`, so a second list is pushed: `[goals, goal/[id], goals]`. Repro: Objectifs → open a goal → Accueil → tap the savings-done card (`SavingsDoneCard`, shown once the month's savings are complete) → Objectifs list; Android back shows the goal again, then a list again. Before this diff the goal sat on the root stack and the tabs could not hold it. Proof `node_modules/expo-router/build/global-state/getNavigationAction.js:48-50`, `StackRouter.js:188-197` → pop `(goals)` to its root before the push (`popTabsToRoot(navigation, ["(goals)"])` from `tab-route.ts:107`), plus a `tab-stacks.spec.tsx` case: open `/goal/g1` in `/goals`, navigate `/home`, push `/goals`, expect `routesUnder(view, "(goals)")` to equal `["goals"]` — 🟡 major

### Limits

- `pulpe://budget?id=` opens « Unmatched Route » on the device (Run 1): expo-router resolves `/budget` before `DeepLinkRouter` acts. Same on `main`, and Android emits no such link yet; a `+native-intent` rewrite would settle it, out of this diff.
- `pulpe://add-expense` still does `router.push("/home")` (`deep-link-router.tsx:52`): with Accueil holding a screen, the same mechanism as the finding pushes a second home over it. Unreachable today (no Android emitter).
- Deleting a month pops every tab and switches to Budgets, where iOS pops only the current tab and stays (`ios/Pulpe/Features/Budgets/BudgetDetails/DeleteMonthMenu.swift:138`). Landing on Budgets predates this diff (`dismissTo("/budgets")` on `main`); resetting unrelated tabs (a goal or a setting left open) is new but matches what the single root stack did before.
- `create.tsx:148` and `plan.tsx:157` `dismissTo("/templates")` would also stack a second list over an open template; only offered with no template, so not reached.
