# Run: Dialog d'explication de Mon patrimoine

## Run 1

- Head: `9214956fe`
- Left: Android not walked on a device (no device running; the tab wiring is covered by `net-worth-screen-intro.spec.tsx` instead). iOS empty-state CTA, Reduce Motion, AX3 and VoiceOver not walked at runtime (the seed account has assets). Web empty-state CTA checked by spec only, for the same reason. iOS `NetWorthView` wiring has no automated test (UI test judged too costly; the gate is unit-tested and the flow was walked on the simulator). Backend integration tests fail locally with `invalid JWT` from the local Supabase keys; the branch touches no backend file. Deviations from the plan: the web step-1 scene is one column (two columns truncated the labels), the scenes read the currency from the user's settings, Android scene entrances slide without opacity (the `EMPHASIS` contrast guard forbids freehand opacity), and iOS sample amounts are whole numbers like web and Android.

| Task | Validation | Result |
| ---- | ---------- | ------ |
| 1.1 | Event names compile on web and Android after the shared build: `pnpm exec turbo run test --continue` | shared 898/898, frontend 3591/3591, Android 1303/1303 (`npx jest`) |
| 1.2 | Swift raw values equal the TS strings: `AnalyticsServiceTests` in `xcodebuild test -scheme PulpeLocal` | passes in the full iOS suite |
| 2.1 | `NetWorthIntroGateTests`: true only when unseen and loaded | passes in the full iOS suite |
| 2.2 | `NetWorthIntroContentTests`: 32 200 / 26 200 / 26 700, action per step, one outcome per opening | passes in the full iOS suite |
| 2.3 | Scene amounts in the user's currency, on the simulator | all three steps shown in CHF; after the whole-number fix, step 1 reads 32’200 with lines 3’200 / 12’000 / 8’000 / 9’000; Reduce Motion not walked |
| 2.4 | One end event per opening, « Plus tard » gone on step 3 | « Later » hidden on step 3 on the simulator; AX3 not walked |
| 2.5 | First visit opens the sheet, later visits do not, « ? » reopens | walked on the simulator: auto-open once, « Got it » closes, tab revisit shows nothing, « ? » reopens |
| 3.1 | Seen key read and written through `StorageService` | stored as `{"version":1,"data":true}` under `pulpe-net-worth-intro-seen` in the browser |
| 3.2 | `net-worth-intro.model.spec.ts` | passes (`ng test --include`) |
| 3.3 | `net-worth-intro-dialog.spec.ts`; no horizontal scroll from 375 to 1280 px | passes; checked in the browser at 375, 812x375 and 1280, dark theme, reduced motion, keyboard and focus return |
| 3.4 | `net-worth-page.spec.ts`; first visit, reload, « ? » in the browser | spec passes; browser: dialog once, nothing after reload, « ? » reopens |
| 4.1 | `net-worth-intro-gate.spec.ts` | passes |
| 4.2 | `net-worth-intro.spec.ts` | passes |
| 4.3 | `net-worth-intro-sheet.spec.tsx` | passes |
| 4.4 | Tab: first visit opens, revisit does not, « ? » reopens, empty CTA opens the form | `net-worth-screen-intro.spec.tsx` 4/4, and fails when either the gate or the add path is removed; not walked on a device |
| 4.5 | `pnpm quality`, `pnpm test:lexicon`, `pnpm test`, `ng build`, iOS suite | quality green in the pre-commit hook, lexicon 12/12, ng build OK, `pnpm test` green except backend env failures, iOS suite 2656 tests passed (`xcodebuild test -scheme PulpeLocal`) |
