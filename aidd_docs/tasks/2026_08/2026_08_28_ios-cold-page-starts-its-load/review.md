# Review: ios-cold-page-starts-its-load

- **Verdict**: changes-requested
- **Diff**: `c0c1fce73...4ed7e26e7`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_28
- **Findings**: 0 critical, 7 warning, 6 minor

## Phases

### Phase 1 — exhaustive-page-content-state

- [x] `BudgetDetailsView.body` contains one `switch screenState.content` and no `isLoading`/`errorIsTerminal`/`isBudgetPresent` — `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift:94`; the three booleans are gone from the view, `Projection/` and `EditTransactionHost.swift`
- [x] Budgets → a month absent from the cache shows the skeleton, then its hero and ledger — `BudgetDetailsView.swift:103` (`.loading` → `BudgetDetailsSkeletonView`); run: `BudgetOpensFromListUITests` green on the cold harness
- [x] `TemplateDetailsView.body` switches on `viewModel.content`; a template opens on its skeleton then its content — `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift:37`, enum at `:250`
- [x] `TemplateDetailsViewModel` can be built with a test double and never touches `TemplateService.shared` when one is passed — `TemplateDetailsView.swift:241,244`; protocol at `ios/Pulpe/Domain/Services/TemplateService.swift:5` (no test uses the seam yet, see Findings)
- [x] The projection test asserts the cold stores project `.loading`, suite green in `PulpeTests` — `ios/PulpeTests/Features/Budgets/BudgetDetails/Projection/BudgetDetailsContentStateTests.swift:20`; run: 2305 tests / 241 suites passed
- [x] `ios-architecture.md` states the rule in one line — `.claude/rules/00-architecture/ios-architecture.md:129`

### Phase 2 — crash-reporting-through-posthog

- [ ] `Package.resolved` pins posthog-ios ≥ 3.56 and the three configurations build — `Package.resolved` lives under the gitignored `*.xcodeproj/` (`ios/.gitignore:3`); the pin is `ios/project.yml:76` (`from: "3.56.0"`, resolves 3.70.0); Local clean build and Prod archive both succeed. Tag: not-applicable
- [x] `AnalyticsServiceTests` proves autocapture on, session replay off; opted-out users send nothing — `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:223-228`, opt-out at `:249-250`, `:302`; enforced by `AnalyticsService.swift:129,247`
- [x] After archiving locally, the symbol set appears under PostHog › Error tracking › Symbol sets — `ios/scripts/upload-dsyms.sh:18`; run: release `app.pulpe.ios@1.4.3+0`, 3 symbol sets `has_uploaded_file: true` in project 87621

### Phase 3 — ci-gates-that-match-the-release

- [x] A SwiftLint violation on a file not in the commit turns the PR red — `.github/workflows/ci.yml:597-599` lints all of `ios/` with `--strict`, job required by `ci-success` (`:821-857`)
- [ ] The CI log shows Xcode 26.6 and an iOS 26.5 simulator — `ci.yml:588` pins 26.6 and `:619-627` prints the version and picks the newest iOS 26 runtime, but no `CI Pipeline` run exists for any of today's 8 pushes (last run: `23ee00bf2`); CodeQL and Vercel did receive the same `pull_request` events, the workflow is `active`, so the block is repo-level (Actions spending limit is the likely one; the API needs the `user` scope). Tag: fix
- [x] A clean build lists only the four type-check-time warnings; the `Trailing` warning is gone — `ios/Pulpe/Shared/Components/PulpeChip.swift:95,244`; run: exactly the 4 `-warn-long-*` warnings

### Phase 4 — ui-smoke-in-ci-on-the-cold-path

- [x] No `BudgetDetailCache` call remains in the harness; `BudgetDetailsPointingUITests` passes locally — `ios/Pulpe/App/BudgetLongPressUITestHarness.swift` (grep empty); run: 3 tests passed
- [x] With the two views checked out at `23ee00bf2`, the smoke test fails; at HEAD it passes — `ios/PulpeUITests/BudgetDetails/BudgetOpensFromListUITests.swift:28,31,37`; run: passes at HEAD, fails at `:29` with the empty-`Group` body reintroduced (the `23ee00bf2` views no longer compile against the new `ScreenState`, so the bug was reintroduced at HEAD instead)
- [ ] The CI job reports exactly one executed test and blocks the PR when it fails — `ci.yml:798` requires `Executed 1 test`, `:803` `TEST SUCCEEDED`, `ci-success` gates on `smoke-ios` (`:830,844,857`), but the job has never executed (same cause as phase 3). Tag: fix

### Phase 5 — string-catalog-specifier-parity

- [x] The fixture with `%@` for `%lld` yields one mismatch; positional variants yield none — `ios/PulpeTests/Resources/LocalizableCatalogTests.swift:74,81`
- [x] The suite is green on the current catalog and appears in the executed tests of `PulpeTests` — `LocalizableCatalogTests.swift:114`; run: `Suite "Localizable catalog" passed`
- [x] A clean build emits no plural-variation warning — `ios/Pulpe/Resources/Localizable.xcstrings` Italian entry uses a named substitution (`argNum: 1`, `formatSpecifier: "lld"`); run: warning list holds only the 4 type-check guards

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | fit | 2 | `ios/Pulpe/Core/Analytics/AnalyticsService.swift:105` | `initialize()` gates only on the API key, so `Config/Preview.xcconfig` (key set, `POSTHOG_ENABLED = false`) runs `setup()` with `errorTrackingConfig.autoCapture = true`; `isEventCapturingEnabled` only gates manual `capture()`, so Preview builds send crashes to the production project while sending zero events, against the config contract and the comment "gates them like every other event". | `config.errorTrackingConfig.autoCapture = isConfiguredEnabled` (pass it into `makeConfig`), or skip `setup()` when PostHog is disabled; add the Preview case to `AnalyticsServiceTests`. |
| 🟡 | functional | 3 | `.github/workflows/ci.yml:588` | "The CI log shows Xcode 26.6 and an iOS 26.5 simulator" is unverified: no `CI Pipeline` run was created for any push since `23ee00bf2`, so the edited `test-ios` job (Xcode pin, runtime picker, SwiftLint step) has never executed. | Check the Actions spending limit / usage for the account, then re-trigger the PR (empty commit or close/reopen) and read `xcodebuild -version` and the picked runtime in the log. |
| 🟡 | functional | 4 | `.github/workflows/ci.yml:724` | "The CI job reports exactly one executed test and blocks the PR when it fails" is unverified: `smoke-ios` has never run, so a setup error in the new job would surface only on a later PR. | Same trigger; confirm the log prints `Executed 1 test` and that `ci-success` fails when it does. |
| 🟡 | code | 5 | `ios/PulpeTests/Resources/LocalizableCatalogTests.swift:34` | code-health: `as? [String: Any]` on the root plus `?? [:]` means a shape change to the catalog (renamed `strings`, a wrapper key) makes `shippedCatalog_hasNoSpecifierMismatch` pass having compared zero keys, the silent-zero trap the `smoke-ios` job guards against with its `Executed 1 test` grep. | Make `mismatches` throw when the root has no `strings` dictionary, and assert a non-trivial key count in the shipped-catalog test. |
| 🟡 | rot | 5 | `.github/scripts/lexicon.test.mjs:349` | `stringUnits` returns on a node's own `stringUnit`, so the new `it` substitution yields only `%#@digits@`: the two Italian plural sentences are invisible to all five iOS lexicon guards (transaction, vouvoiement, verbe bancaire, ß, complétude), and every future substitution escapes them the same way. | Descend into `substitutions` too: do not return early when a node carries both `stringUnit` and `substitutions`. |
| 🟡 | rot | 5 | `ios/PulpeTests/Resources/LocalizableCatalogTests.swift:33` | `values(under:)` plus the variations/substitutions recursion re-implements `iosTranslations()` / `stringUnits` from `.github/scripts/lexicon.test.mjs:349-363` in a second language and suite; the five existing catalog invariants run in `pnpm quality` (pre-commit and every PR) while this sixth runs only in the macOS `test-ios` job. | Assert specifier parity on top of `iosTranslations()` in `lexicon.test.mjs` (~8 lines, once the walker handles substitutions) and drop the Swift suite. |
| 🟡 | code | 1 | `ios/Pulpe/Domain/Services/TemplateService.swift:5` | code-health: `TemplateServicing` and the `templateService:` init parameter have one implementation and no injection site (`TemplateDetailsView.swift:32`, `EditTemplateLineSheetTests.swift:136` both take the default), so the doc comment "a test can drive the page without the network" describes a test that was never written (root `CLAUDE.md`: ship the minimum). | Add the `TemplateDetailsViewModel` test that injects a stub through the seam, or drop the protocol and restore `private let templateService = TemplateService.shared`. |
| 🟢 | code | 1 | `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift:51` | code-health: the body switches on `viewModel.content` but the animation is still keyed on `viewModel.isLoading`, while the sibling page moved to `value: screenState.content` in the same phase. | Make `Content` `Equatable` (or compare a case tag) and animate on `viewModel.content`. |
| 🟢 | code | 1 | `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift:99` | code-health: `projector.terminalError ?? APIError.invalidResponse` is unreachable, `terminalError` is set in the same projection pass that yields `.failed` (`BudgetDetailsProjector.swift:83`); same at `EditTransactionHost.swift:58`. | Carry the error where the state is decided, or a one-line comment stating the invariant so the `??` is not read as a live path. |
| 🟢 | fit | 4 | `.github/workflows/ci.yml:724` | `smoke-ios` declares no `needs: test-ios` although `phase-4.md` projected it: it boots a second macOS runner concurrently and still runs the UI test when the unit job already failed. | Add `needs: test-ios`. |
| 🟢 | rot | 4 | `.github/workflows/ci.yml:753` | The Xcode setup, XcodeGen install, SPM cache and the Python simulator picker are byte-identical to `test-ios` (`ci.yml:614`), two copies of the runtime-selection logic to keep in sync. | Extract them into a composite action under `.github/actions/` used by both jobs. |
| 🟢 | fit | 4 | `ios/Pulpe/App/ContextualCreationUITestHarness.swift:61` | The phase removed the cache seeding from one harness because it hid the cold path, but this sibling harness still calls `store(...)` + `storeAllBudgets(...)`, keeping its budget-page tests on the warm path. | Drop the seeding there too and let its stub service answer the fetch. |
| 🟢 | rot | 4 | `ios/PulpeUITests/BudgetDetails/BudgetOpensFromListUITests.swift:34` | The title check searches `app.descendants(matching: .any)`, so it proves "some element is labelled août 2026", not "the navigation title is the month". | Scope it to `app.navigationBars.staticTexts.matching(predicate).firstMatch`. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 83% (15/18)                                       |
| Files checked | `.github/workflows/ci.yml`, `.claude/rules/00-architecture/ios-architecture.md`, `ios/.swiftlint.yml`, `ios/project.yml`, `ios/scripts/upload-dsyms.sh`, `ios/Pulpe/App/BudgetLongPressUITestHarness.swift`, `ios/Pulpe/Core/Analytics/AnalyticsService.swift`, `ios/Pulpe/Domain/Services/TemplateService.swift`, `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift`, `.../BudgetDetails/EditTransactionHost.swift`, `.../Projection/BudgetDetailsProjector.swift`, `.../Projection/BudgetDetailsScreenState.swift`, `ios/Pulpe/Features/Templates/TemplateDetails/TemplateDetailsView.swift`, `.../TemplateDetails/EditTemplateLineSheet.swift`, `ios/Pulpe/Resources/Localizable.xcstrings`, `ios/Pulpe/Shared/Components/PulpeChip.swift`, `ios/PulpeTests/Architecture/BudgetDetailsArchitectureTests.swift`, `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift`, `ios/PulpeTests/Domain/Formulas/BudgetFormulasExtendedTests.swift`, `.../BudgetDetails/BudgetDetailsToggleTransactionTests.swift`, `.../Projection/BudgetDetailsContentStateTests.swift`, `.../Spread/AddBudgetLineSpreadLogicTests.swift`, `ios/PulpeTests/Resources/LocalizableCatalogTests.swift`, `ios/PulpeUITests/BudgetDetails/BudgetOpensFromListUITests.swift`, `landing/app/(fr)/privacy/page.tsx` |
| Unchecked     | P2 `Package.resolved` pin — not-applicable (gitignored, `from:` floor is the pin); P3 CI log shows Xcode 26.6 / iOS 26 sim — fix; P4 CI job reports one executed test and blocks — fix |
| Unplanned     | `ios/.swiftlint.yml:16` excludes `build` (no phase projects it; the local archive's SourcePackages took lint from >180 s to 0.3 s); phase-3 task 1.2 projected 5 lint violations, 9 were fixed (adds `EditTemplateLineSheet.swift` extension move and the `BudgetDetailsCoordinatorToggleTransactionTests.swift` → `BudgetDetailsToggleTransactionTests.swift` rename). Everything else traces to a criterion |
