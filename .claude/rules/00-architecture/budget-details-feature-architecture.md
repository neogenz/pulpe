---
description: BudgetDetails iOS feature architecture — Stores + Projector + Coordinator + Router. Apply to any feature with 5+ mutations / 3+ derivations / persisted filters.
paths: "ios/Pulpe/Features/Budgets/BudgetDetails/**/*.swift"
---

# BudgetDetails feature architecture

This feature uses a layered split that other complex iOS features should adopt when they hit the same complexity ceiling (5+ mutations, 3+ derivations consumed by body, persisted filter state, soft-delete + undo).

## Layer responsibilities

| Layer | Type | Responsibility |
|---|---|---|
| **State stores** (`State/*Store.swift`) | `@Observable @MainActor final class` | One responsibility each: data, filters, sync, mutation queue. Source of truth. `private(set)` everywhere. |
| **Projector** (`Projection/BudgetDetailsProjector.swift`) | `@Observable @MainActor` | Reads stores, produces `BudgetDetailsScreenState` DTO via pure `static func project(...)`. Re-runs only on source change via `withObservationTracking`. |
| **ScreenState DTO** (`Projection/BudgetDetailsScreenState.swift`) | `struct Equatable` | Immutable, pre-shaped, indexed for O(1) lookup. **The only thing the view reads.** |
| **Coordinator** (`Coordinator/BudgetDetailsCoordinator.swift`) | `@MainActor final class` | `dispatch(_ action: BudgetDetailsAction) async` — single mutation entrypoint. Orchestrates optimistic local apply → API call → reconcile or rollback. Emits toast/haptic/router pushes. |
| **Action enum** (`Coordinator/BudgetDetailsAction.swift`) | `enum` | Typed mutations. No free-form Tasks in views. |
| **Router** (`Routing/BudgetDetailsRouter.swift`) | `@Observable @MainActor` | Owns `NavigationPath` + sheet state. `push(_:)`, `present(_:)`, `dismissSheet()`. Views never write `appState.budgetPath` directly. |
| **Views** (`Views/**`) | `struct: View` | Read `screenState` only. Dispatch actions. Subscribe to router. **Zero `.filter`/`.sorted`/`.map`/`BudgetFormulas.*` in body.** Rows accept primitives (e.g. `currency: SupportedCurrency`), not stores. |
| **Helpers** (`Helpers/`) | small components | `AutoPopView`, `View+afterPushTransition`. Sole permitted location for `Task.sleep`. |

## Hard rules (lint-enforced, arch-tested)

1. **No `BudgetFormulas.*` calls inside any view file in this feature.** Derivation lives in the projector.
2. **No `.filter` / `.sorted` / `.map` calls inside any view body or computed `some View` in this feature.** Pre-shape in DTO.
3. **No `@Environment(UserSettingsStore.self)` inside row files** (`Views/Rows/**`). Pass `currency: SupportedCurrency` via init.
4. **No `appState.budgetPath` mutation outside `BudgetDetailsRouter.swift`.** All push/pop go through the router.
5. **No `Task.sleep` inside the feature outside `Helpers/AutoPopView.swift` and `Helpers/View+afterPushTransition.swift`.**
6. **No magic timing literals** (`.milliseconds(150 | 200 | 300)`). Use `DesignTokens.Animation.autoPopGraceMs` / `DesignTokens.Animation.pushAutofocusDelayMs` / `DesignTokens.Sync.indicatorRampDelayMs`.
7. **No `swiftlint:disable file_length` or `type_body_length`** anywhere in the feature. Split the file.
8. **Every file in this feature ≤ 350 LOC.** Hard error in CI after Phase 5.
9. **All mutations route through `BudgetDetailsCoordinator.dispatch(_:)`.** Views never call `*Service.shared.*` directly for mutations.
10. **`BudgetDetailsViewModel` does not exist.** It was retired in Phase 4 of the refactor.

## When to apply this pattern to a new feature

Apply when ALL of the following are true:

- The feature has 5+ distinct mutations (toggle, add, update, delete, undo, …).
- The feature consumes 3+ derived projections of source data (sections, counts, hero metrics, …) inside view bodies.
- The feature persists filter or selection state across launches.
- The feature has a soft-delete / undo flow with shared toast.
- The feature spans 3+ pushed pages with auto-pop on model removal.

If only 1-2 of these are true, simpler `@Observable` view model in the view file is fine. **Do not over-engineer.**

## Reference plan

See `ios/docs/BUDGET_DETAILS_REFACTOR_PLAN.md` for the migration plan and phase-by-phase acceptance criteria.

## Anti-patterns

| Anti-pattern | Why it's wrong | Replacement |
|---|---|---|
| `BudgetFormulas.calculateConsumption(...)` inside `ForEach` row builder | O(N×M) per body re-eval | Pre-compute `consumptionByLineId` in projector; row receives `Consumption` value via input |
| Computed `var displayedSections: [...]` in VM (recomputed per access) | Re-runs on every body re-eval | Projector caches the result; view reads `screenState.sections` |
| `@Environment(UserSettingsStore.self)` inside `BudgetLineMixedRow` | Broad observation fan-out — store changes invalidate every row | `let currency: SupportedCurrency` passed via init |
| `appState.budgetPath.append(...)` in `BudgetDetailsView` | Couples view to global state shape; deeplink writes race with view writes | `router.push(.lineDetail(lineId:))` |
| `Task.sleep(for: .milliseconds(150))` inline in view body | Magic timing, no respect for animation lifecycle | `AutoPopView(graceMs: DesignTokens.Animation.autoPopGraceMs) { … }` |
| `private extension BudgetLineDetailPage { @ViewBuilder func heroSection(...) }` | Blows up file size; sub-views can't be previewed independently | Dedicated `struct BudgetLineHeroSection: View` with own `#Preview` |
| `// swiftlint:disable file_length` | Hides the actual problem (file too large) | Split the file; use stores/projector/coordinator |
