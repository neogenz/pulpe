# Review: Dialog d'explication de Mon patrimoine

## Round 1
- Diff: `origin/main...c2cd8356b`
- Uncommitted changes: yes (iOS phase 2: `NetWorthView.swift`, `Intro/*`, `Localizable.xcstrings`, `DesignTokens.swift`, `.swiftlint.yml`, two test files)
- Axes: code, functional, relevancy
- Verdict: approve, because no critical or major finding and no criterion is unmet in the code; the whole iOS phase and every on-device check stay unverified until a run lands (no iOS build or test on this head)
### Criteria
- [x] P1.1 `ANALYTICS_EVENTS.NET_WORTH_INTRO_VIEWED` compiles on web and Android — `shared/src/feature-flags.ts:199-201`; `ng build` pass and Android `tsc` clean recorded on this head
- Unverified at runtime: P1.2 Swift raw values equal the TS strings and `AnalyticsServiceTests` passes — values match (`ios/Pulpe/Core/Analytics/AnalyticsEvent.swift:120-122`, expected set `AnalyticsServiceTests.swift` static), suite not run on this head
- Unverified at runtime: P2.1 `NetWorthIntroGateTests` passes — logic `ios/Pulpe/Features/NetWorth/Intro/NetWorthIntroGate.swift:10-12` covers the four combinations; a simulator run shows green
- Unverified at runtime: P2.2 `NetWorthIntroContentTests` passes (32 200 / 26 200 / 26 700, action per step, one outcome) — `NetWorthIntroContent.swift:22-25,53-60,88-90`; a simulator run shows green
- Unverified at runtime: P2.3 amounts in the user's currency, no movement with Reduce Motion — currency from `store.totals.baseCurrency` (`NetWorthView.swift:286`), Reduce Motion path `NetWorthIntroScene.swift:61-66,321`; a simulator run in EUR with Reduce Motion shows it
- Unverified at runtime: P2.4 one end event per opening, no « Plus tard » on step 3, readable at AX3 — `NetWorthIntroSheet.swift:22,62,102-106`; AX3 needs the simulator
- Unverified at runtime: P2.5 first visit opens, next visits don't, « ? » opens, empty CTA opens the form — `NetWorthView.swift:62-68,85-99,119-125`; a simulator run shows it
- [x] P3.1 seen key read and written through `StorageService`, validated by its schema — `storage-schemas.ts` `NET_WORTH_INTRO_SEEN` (`z.boolean()`, scope user), `net-worth-page.ts:410,425`
- [x] P3.2 `net-worth-intro.model.spec.ts` passes — web net-worth specs 87/87 recorded
- [x] P3.3 dialog spec passes; no horizontal scroll from 375 to 1280 px — 87/87 and dev-browser record at 375×812, 812×375, 1280×800
- [x] P3.4 `net-worth-page.spec.ts` passes; browser: first visit opens, reload does not, « ? » opens — 87/87 and dev-browser record
- Unverified at runtime: P3.4 empty CTA leads to the form in the browser — covered only by `net-worth-page.spec.ts` (help + `'add'` → `openCreate`); the demo account is not empty
- [x] P4.1 `net-worth-intro-gate.spec.ts` passes — Android jest net-worth 34/34
- [x] P4.2 `net-worth-intro.spec.ts` passes — 34/34
- [x] P4.3 `net-worth-intro-sheet.spec.tsx` passes — 34/34
- Unverified at runtime: P4.4 on device: first visit, back to the tab, « ? », empty CTA → form — no device run; the same-commit swap of two RN `Modal`s (`net-worth.tsx:253-263`) is the part most worth seeing
- Unverified at runtime: P4.5 `pnpm quality`, `pnpm test:lexicon`, `ng build` recorded green; full `pnpm test` and the iOS suite not recorded on this head
### Assumptions
- Event names and property contract are identical on the three platforms — holds, checked at `shared/src/feature-flags.ts:193-201`, `AnalyticsEvent.swift:120-122`, `NetWorthIntroContent.swift:41-48`, `net-worth-intro-dialog.ts:493-508`, `net-worth-intro-sheet.tsx:76-91`
- Exactly one end event per opening — holds: web `afterClosed` only (`net-worth-intro-dialog.ts:493`), iOS `NetWorthIntroCompletion` guards button + `onDisappear` (`NetWorthIntroSheet.swift:62,102-106`), Android `isFinished` ref (`net-worth-intro-sheet.tsx:76-78`)
- Auto-open only on a settled page (empty or filled, never loading or failed) — holds: web `net-worth-page.ts:395-402`, iOS `store.netWorth != nil` is exactly `.empty`/`.loaded` (`NetWorthView.swift:36-39,95`), Android `sections !== null` is exactly the empty/filled bodies (`net-worth.tsx:126-127`)
- iOS sample currency follows the user even on an empty net worth — holds, `totals` is non-optional on the response (`ios/Pulpe/Domain/Models/Asset.swift:67`), so `NetWorthView.swift:286` never falls back to CHF once loaded
- The empty CTA opens the creation form only after the explainer is gone — holds: iOS `onDismiss` (`NetWorthView.swift:119-125`), web awaits `afterClosed` (`net-worth-page.ts:420-426`), Android renders the form only when `introSource === null` (`net-worth.tsx:263`)
- New copy present in all languages — holds: 25 `netWorth.intro.*` keys in each of the 4 web and 4 Android catalogs; every new iOS key has de/en/it in `Localizable.xcstrings`, including the interpolated `Étape %lld sur %lld`, `%@ mis de côté…` and the three `Exemple : …` labels
- `--pulpe-amber` exists on the web — holds, `app/styles/_financial-colors.scss`
### Findings
- `frontend/projects/webapp/public/i18n/fr.json:1565` : `netWorth.intro.stepOf` is added to the 4 web catalogs but nothing reads it (dots are `aria-hidden`, `net-worth-intro-dialog.ts:210`); same for Android `netWorth.intro.later` (`android/src/core/i18n/catalogs/fr.json:1238`, the sheet uses the `FormModal` cross), proof: no `intro.stepOf` under `frontend/projects/webapp/src`, no `intro.later` under `android/src` → delete both keys from their 4 catalogs — 🟢
- `frontend/projects/webapp/src/app/feature/net-worth/components/net-worth-intro-dialog.ts:375-377` : under `prefers-reduced-motion` the budget hint still waits 1.9 s before its fade, because `.rise.late` (specificity 0,2,0) beats the media query's `.rise` shorthand, proof `net-worth-intro-dialog.ts:432-441` → add `.rise.late { animation-delay: 0s; }` inside the reduced-motion block — 🟢
- `frontend/projects/webapp/src/app/feature/net-worth/components/net-worth-intro-dialog.ts:468-479` : the screen-reader sentence formats amounts with the display symbol (`€`), while `webapp-currency-formatting.md` asks for the ISO code in accessibility text, proof `.claude/rules/03-frameworks-and-libraries/webapp-currency-formatting.md` (« aria-label / VoiceOver » row) → format `sceneParams` with the currency code — 🟢
### Limits
- No platform announces the new step to a screen reader: focus stays on the primary button and no live region carries the new title (`net-worth-intro-dialog.ts:194-206`, `NetWorthIntroSheet.swift:34-40`, `net-worth-intro-sheet.tsx:143-148`) — a VoiceOver / TalkBack / NVDA pass would show whether « Suivant » is followed by silence
- Web step 1 slides tiles ±3rem with no `overflow: hidden` on `.scene` (`net-worth-intro-dialog.ts:349-365`), which can widen `mat-dialog-content`'s scroll area for about 1 s at 375 px — sampling `scrollWidth` during the animation would settle it (the recorded check may have been taken after it ended)
- iOS and Android tabs stay mounted after a first visit: if the data lands after the user has already switched tabs, the auto-open would present over another tab (`NetWorthView.swift:95`, `net-worth.tsx:126-127`) — open the tab on a slow network, leave before it loads
- iOS sheet-level `.animation(DesignTokens.Animation.stepTransition, value: step)` (`NetWorthIntroSheet.swift:57`) springs the card's height change between steps even with Reduce Motion — the simulator with Reduce Motion on would show whether it reads as movement
- iOS shows the sample with `asAmount(for:)`, so two decimals (`3'200.00`, `+500.00 ici`) where web and Android show whole numbers — matches the plan's « asAmount » instruction, but breaks « captures comparables »; a simulator screenshot would settle whether it matters
- Nothing on iOS was compiled on this head — the running simulator suite settles compilation, `NetWorthIntroGateTests`, `NetWorthIntroContentTests` and `AnalyticsServiceTests`
