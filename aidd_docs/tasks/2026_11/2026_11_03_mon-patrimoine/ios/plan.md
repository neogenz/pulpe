---
objective: "On iOS, behind the `net_worth` flag, a user does everything the web « Mon patrimoine » offers, in the V2 visual language, against the same API and with the same figures, and nothing changes with the flag off."
status: pending
---

# Plan: Mon patrimoine (iOS)

Source: [`spec.md`](./spec.md). Web reference: [`../plan.md`](../plan.md), [`../phase-3.md`](../phase-3.md) to [`../phase-7.md`](../phase-7.md).

## Phases

| #   | Phase                                              | File                           | Depends on |
| --- | -------------------------------------------------- | ------------------------------ | ---------- |
| 1   | Asset API client and error copy                    | [`phase-1.md`](./phase-1.md)   | none       |
| 2   | Asset store, rollout flag and logout reset         | [`phase-2.md`](./phase-2.md)   | 1          |
| 3   | « Mon patrimoine » screen and Objectifs entry      | [`phase-3.md`](./phase-3.md)   | 2          |
| 4   | Asset form and row actions                         | [`phase-4.md`](./phase-4.md)   | 3          |
| 5   | Value and categories sheets                        | [`phase-5.md`](./phase-5.md)   | 4          |
| 6   | Breakdown diagram                                  | [`phase-6.md`](./phase-6.md)   | 3          |
| 7   | Reconciliation refreshes in-Pulpe assets           | [`phase-7.md`](./phase-7.md)   | 2          |
| 8   | Asset picker on prévisions and template lines      | [`phase-8.md`](./phase-8.md)   | 2          |
| 9   | Value suggestions and refresh on return            | [`phase-9.md`](./phase-9.md)   | 3, 8       |
| 10  | Income drawn from an asset                         | [`phase-10.md`](./phase-10.md) | 8          |

## External sources

| URL | What it settled |
| --- | --------------- |
| none | Every API, component and pattern relied on was read in the repository |

## Impact

| Category      | Verdict and evidence | Handled in |
| ------------- | -------------------- | ---------- |
| runtime       | Endpoints and payloads observed in `backend-nest/src/modules/asset/infrastructure/http/asset.controller.ts` and `asset-category.controller.ts` and in `shared/schemas.ts:3065-3222`; writes return `assetRecordSchema` (no amount), so the store refetches `GET /v1/assets` after each write, like the web store. PostHog is off in Local and Preview (`ios/Config/Local.xcconfig:8`, `Preview.xcconfig:8` `POSTHOG_ENABLED = false`) and `AnalyticsService.isFeatureEnabled` returns `false` there (`AnalyticsService.swift:330`): the flag must be cached in `UserDefaults` so a simulator check can force it, as the retired `FeatureFlagsStore` did (`git show c2daf8a260^:ios/Pulpe/Domain/Store/FeatureFlagsStore.swift`). `net_worth` exists in PulpeProd PostHog: unverified. | 1, 2 |
| regression    | Medium: `BudgetLine`, `TemplateLine` and six request DTOs gain `assetId`. Decoding stays tolerant (synthesized `decodeIfPresent`); `BudgetLine.toggled()` (`BudgetLine.swift:121`) rebuilds the line field by field and would drop the link. Covered by `BudgetLineTests`, `EditBudgetLineSheetTests`, `EditTemplateLineSheetTests`, `AddBudgetLineSpreadLogicTests`, `BudgetLineSpreadRequestTests` (observed). Safety net no: those suites run unchanged first and stay green with the flag off, which is the regression lock. | 8 |
| regression    | Medium: the reconciliation gains pre-filled rows and a write after completion; three entry points (`CalculationSheet.swift:52`, `ToPointPage.swift:59` through `CurrentMonthReconcileSheet`, and `BudgetDetailsRealizedBalanceSheet.swift:20`). `ReconcileAccountsFlowTests` and `AccountReconciliationTests` (observed) run unchanged with no linked account. | 7 |
| regression    | Low: `SavingsOriginToggle` is shared with `MovementSheet+Details.swift:12`; the new « Tiré de mon patrimoine » segment is opt-in with a default that keeps the movement sheet unchanged. Covered by `AddBudgetLineIncomeOriginTests`, `MovementSheetTests` (observed). | 10 |
| regression    | Any view reading a new `@Environment` store crashes where that store is not injected: UI-test harnesses `BudgetLongPressUITestHarness.swift:318-325`, `ContextualCreationUITestHarness.swift` inject their own stores (observed); `SavingsGoalIntervalUITestHarness.swift:386-416` renders goal detail, history and a `TemplateLineRow` list, none of which the plan touches, so it needs nothing. Phase 2 injects both new stores in the first two. | 2 |
| privacy       | Logout calls `LiveSessionDataResetter.resetStores()` (`SessionDataResetting.swift:35-44`, asserted by `SessionDataResetterTests.swift:73`); `AssetStore` joins it and bumps its load generation so an in-flight read of the previous account is dropped. No analytics event is added; amounts and asset names never reach PostHog. | 2 |
| architecture  | New `Domain/Models/Asset.swift`, `Domain/Services/AssetService.swift` (actor), `Domain/Store/AssetStore.swift` and `Domain/Store/FeatureFlagsStore.swift`, injected at app root like `SavingsGoalStore`. New `Features/NetWorth/` reached through a `NetWorthDestination` resolved in `MainTabView`, so `Features/SavingsGoals` never imports `Features/NetWorth` (`ios-architecture.md` forbids `Features/X → Features/Y`). The asset picker lives in `Shared/Components/` beside `SavingsGoalPickerField`. The Sankey is a Swift port of the web mapping plus a SwiftUI `Canvas`; no money is computed on device. | 1, 2, 3, 6, 8 |
| file ceilings | `PulpeApp.swift` is at 498 lines and `ReconcileAccountsSheet.swift` at 484 against the strict 500 wall (`.swiftlint.yml:44` warns at 500; `--strict` in `.github/workflows/ci.yml:602` makes it fail); `EditTemplateLineSheet.swift` 423, `EditBudgetLineSheet.swift` 388, `MainTabView.swift` 468 (all `wc -l`). `Features/Budgets/BudgetDetails/*` files stay ≤350 (`BudgetDetailsArchitectureTests.swift:72`). Phases 2 and 7 extract code before adding any. | 2, 7, 8 |
| localization  | iOS ships fr, en, de, it from `Pulpe/Resources/Localizable.xcstrings` (source `fr`); `pnpm test:lexicon` fails on any key missing a translated de, en or it unit, on « transaction » and on formal address (`.github/scripts/lexicon.test.mjs:372-430`). The web already holds the four-language copy under `netWorth.*` and `apiError.asset*` in `frontend/projects/webapp/public/i18n/{fr,en,de,it}.json`: each phase reuses it. | 1, 3, 4, 5, 6, 7, 8, 9, 10 |
| documentation | `docs/BUSINESS_RULES.md` « Patrimoine » is platform-neutral already except two « le web » mentions (lines 55, 61), which become « les clients ». `ios/DESIGN.md` gains the Objectifs entry under Navigation and the breakdown diagram under V2 building blocks. | 3, 6 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `.claude/rules/00-architecture/ios-architecture.md`: actor services, `@Observable @MainActor` stores with `StoreProtocol`, no `Features/X → Features/Y`, page bodies `switch` on a content enum | New service, store and feature folder |
| `.claude/rules/01-standards/no-magic-design-values.md` and `ios/DESIGN.md` § No Magic Values, Chip Composition, Form Rule | Every new view; chips through `PulpeChip`, forms through `SheetFormContainer`, `FormCard`, `HeroAmountField` |
| `ios/CLAUDE.md` shared components table | Sheets, amount input, banners, empty state, currency formatting (`asCurrency`, never concatenation) |
| `.claude/rules/07-*/testing-swift-testing.md`: Swift Testing only, `-only-testing:` can select zero tests | Every phase reads the executed count |
| Root `CLAUDE.md` vocabulary and `pnpm test:lexicon` | All French copy in « je » with « tu » address, never « transaction » |
| Memory: `-configuration Local`, explicit `-derivedDataPath`, tests only on the « Pulpe Tests » simulator, `xcodegen generate --use-cache` | Validation commands of every phase |
| Memory: `String??` for a tri-state PATCH field | `assetId` on budget-line and template-line updates |
| `.claude/rules/05-*/posthog-events.md` | No event is added; the flag key mirrors `FEATURE_FLAGS.NET_WORTH` in `shared/src/feature-flags.ts:42` |

## Decisions

| Decision | Why |
| -------- | --- |
| Restore a UserDefaults-backed `FeatureFlagsStore` exposing `isNetWorthEnabled` | `isFeatureEnabled` is not observable and is always `false` in Local; the retired store already solved both and is the documented simulator override path |
| « Mon patrimoine » is a pushed page from a `ContextLinkRow` at the end of the « Objectifs » list (and under the presets of its empty state), not a fifth tab | Spec; `ios/DESIGN.md` Navigation fixes four tabs |
| Superseded on 2026-11-09: « Mon patrimoine » is a fifth tab, Patrimoine, after Objectifs and shown only while `net_worth` is on; the Objectifs row is removed | Maxime's product decision after the build: the feature is important and the flag already limits the five tabs to the rollout. This overrides the spec's four-tab constraint and entry-point context, which stay as written because the spec is locked |
| The screen revalidates `GET /v1/assets` each time it appears instead of wiring pointing to the asset store | Pointing never fires `onMutation` (`CurrentMonthStore.swift:741`); one read per appearance covers every place a prévision can be pointed |
| The PATCH of a prévision or template line sends `assetId` only when the link changed | « The link survives edits that don't touch it », and with the flag off the key is never sent, so existing flows send byte-identical bodies |
