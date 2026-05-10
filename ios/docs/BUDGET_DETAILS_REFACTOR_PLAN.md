# Budget Details — Refactor Plan (PUL-209+)

**Status**: Draft — Phase 0 in progress
**Owner**: Maxime (solo, AI-assisted)
**Linked Linear**: TBD (split per phase)
**Last updated**: 2026-05-10

---

## 0. Why this exists

`Features/Budgets/BudgetDetails/` is the most complex feature in the iOS app. It mixes data sourcing, derivation, mutation, navigation, filter persistence, soft-delete + undo, sync indicators, multi-currency, auto-pop, sticky pager and accessibility. The current shape grew organically and hit three structural ceilings:

1. **Single 910 LOC `BudgetDetailsViewModel`** — `swiftlint:disable file_length` + `type_body_length` already in the file. Mixing source state + derivation + mutation + nav + side effects.
2. **Heavy derivations recomputed in view body** — `BudgetFormulas.calculateConsumption` runs O(N×M) per body re-eval inside `BudgetMixedSection.body` and `BudgetLineDetailPage.heroSection`. `kindCounts` / `checkedCounts` / `displayedSections` are computed-on-read.
3. **Routing entangled with VM** — `@State destination` + `appState.budgetPath.append` in 7+ call sites; `BudgetLinePushRoute` lives in a view file; deeplinks reach into `AppState`.

This refactor pays the debt **without changing user-visible behavior**. Every product rule below must remain identical post-refactor. We use this rewrite to install the anti-drift floor that protects every future feature.

---

## 1. Goals

### Product-level (must remain unchanged)

P1. The page renders the same hero, sections, sticky pager, FAB, search bar, filters, sheets, and toolbar.
P2. The check (pointer) flow keeps the **alert-when-children-unchecked** business rule (`BudgetDetailsViewModel.toggleBudgetLine` lines 460-470) — tapping a parent line that has unchecked allocated transactions opens the alert "Pointer les transactions ?" with the two branches "Non, juste la prévision" and "Oui, tout pointer".
P3. Soft delete (transaction + budget line) keeps a **shared LIFO undo stack** displayed via a single toast that refreshes its label on each new deletion (`presentOrRefreshDeletionToast`), commits on toast finish, and rolls back on undo. Both items types share the same toast.
P4. Filters (`typeFilter`, `checkedFilter`) persist across launches via `UserDefaults` (legacy Bool key `pulpe-budget-show-only-unchecked` + new String key `pulpe-budget-checked-filter` + `pulpe-budget-line-type-filter`). Migration semantics preserved.
P5. Counts: `kindCounts` reflects "what tapping each kind pill would show against the active checkedFilter". `checkedCounts` reflects "what tapping each état would show against the active typeFilter". They are NOT symmetric reductions.
P6. Search filters lines by name OR amount text OR linked transaction name/amount (O(n+m) Dictionary index). Matches `localizedStandardContains`.
P7. Multi-currency: if the user's effective display currency differs from the row's original capture currency, the FX badge shows; edit form shows a read-only currency picker; transaction creation runs `CurrencyConversionService.convert(...)` server-side for FX.
P8. Auto-pop: any push detail page (`BudgetLineDetailPage`, `AddAllocatedTransactionPage`, `EditTransactionPage`) auto-dismisses 150ms after its target model disappears from the viewmodel.
P9. Sync indicator: a row's sync dot only flashes if the optimistic mutation takes >300ms (`PointCircle.task(id: isSyncing)` ramp).
P10. Accessibility: VoiceOver labels, `accessibilityElement(.contain)` for row toggles, Dynamic Type via `PulpeTypography`, `@Environment(\.accessibilityReduceMotion)` gates `gentleSpring` / `bouncySpring`, `sensitiveAmount()` for amounts hidden mode.
P11. Two decimals on this page only (`asAmount`, `asCurrency`) per `feedback_two_decimals_ios_budget_detail` (2026-05-08). `asCompactCurrency` proscribed in this feature.
P12. Sticky month pager — opaque header → variable-blur chip → fade-to-clear with hero `minY` driving the fade, +32pt dead zone before sticky activates, FAB stays anchored bottomTrailing.
P13. Optimistic mutation: local update applied synchronously, server call async, rollback on failure with `error` surfaced to view.
P14. Adjacent budget cache invalidation on rollover-affecting mutations.

Any deviation from P1–P14 = regression. All must have at least one test.

### Technical-level (post-refactor invariants)

T1. **No file > 350 LOC** in `Features/Budgets/BudgetDetails/`. No `swiftlint:disable file_length` or `type_body_length`. (Reduce SwiftLint thresholds to file_length=400 / type_body_length=300 hard error after migration.)
T2. **Zero `BudgetFormulas.*` calls inside any `body: some View` or computed `some View`.** All derivation lives in the projector or domain layer.
T3. **Zero `.filter`, `.sorted`, `.map` on lists/transactions inside view bodies of this feature.** Pure pre-shaped DTO consumption.
T4. **Per-feature router** (`BudgetDetailsRouter`) owns push + sheet state. `AppState.budgetPath` stays as the public surface for deeplinks but writes are funneled through the router.
T5. **Single mutation entrypoint** (`BudgetDetailsCoordinator.dispatch(_:)`) for all 8+ mutation flows (add line, add tx, update line, update tx, toggle line, toggle tx, soft-delete tx, soft-delete line, undo).
T6. **Rows accept primitives, not stores.** `BudgetLineMixedRow` and `BudgetLineDetailTransactionRow` MUST NOT read `@Environment(UserSettingsStore.self)`.
T7. **Test coverage parity or higher.** Existing 1997 LOC of `BudgetDetailsViewModel*` tests must continue to pass — either against the new architecture (preferred) or via a thin compatibility shim that disappears after migration.
T8. **Architecture tests** (PulpeTests/Architecture) gate the invariants T1–T6 in CI.
T9. **No `Task.sleep` outside dedicated helpers** (`AutoPopView`, autofocus helper). Custom SwiftLint rule enforces.
T10. **No magic 300ms / 150ms numbers** — promoted to `DesignTokens.Animation` + `DesignTokens.Sync`.

### Performance-level (measurable)

Pf1. Per body re-eval of `BudgetDetailsView.content`: zero calls to `BudgetFormulas.calculateConsumption`, zero `.filter` / `.sorted` / `.map` over `budgetLines` or `transactions`.
Pf2. Toggling a budget line: O(1) mutation + O(N) projection rebuild at most once per dispatch (not once per body re-eval). Verified by an Instruments-driven measurement: median main-thread work per toggle ≤ 20ms on iPhone 14 sim, 50 lines + 200 transactions.
Pf3. Scrolling the page with 30+ lines + 100+ transactions: zero `BudgetFormulas` calls during scroll (verified by `analyze_trace.py` SwiftUI-causes top sources).
Pf4. `kindCounts` / `checkedCounts` recomputed at most once per source-state change, never per body access.
Pf5. `cachedRealizedMetrics` only computed when `RealizedBalanceSheet` is presented (lazy).
Pf6. `.animation(_:value:)` on the list does not allocate per body re-eval — backed by a tick counter.

---

## 2. Non-goals

NG1. Do NOT change CurrentMonth feature in this refactor (similar perf issues exist in `CurrentMonthStore`, but scope is locked to BudgetDetails). Pattern propagation = follow-up roadmap item.
NG2. Do NOT introduce 3rd-party deps (TCA, Combine, etc.).
NG3. Do NOT change backend API shape, Supabase schema, or shared Zod types.
NG4. Do NOT alter the Liquid Glass / sticky-pager visual language. Pixel-identical screenshots.
NG5. Do NOT rewrite `BudgetFormulas`. Pure functions stay.
NG6. Do NOT migrate to Swift Observation `@Observable` macro on types that are already there — they already use it.
NG7. Do NOT touch `widget` or `landing` in this work.

---

## 3. Acceptance criteria

Acceptance is split into **product behavior gates** (pass/fail per scenario) and **architecture/perf gates** (pass/fail per metric). All must pass before merge of the final PR.

### 3.1 Product behavior gates (Swift Testing scenarios)

| ID | Scenario | Pre-conditions | Action | Expected |
|---|---|---|---|---|
| AC-P1 | Render | Loaded budget with 2 income, 3 saving, 5 expense, 8 transactions, no rollover | Open BudgetDetails | Hero shows "Disponible · CHF" with formatted amount; 3 sections in order income → saving → expense; FAB visible; pager bar visible. |
| AC-P2 | Toggle line w/o tx | Expense line, no allocated tx | Tap PointCircle | No alert. Line flips `isChecked=true` optimistically. Server-side toggle called. Toast "Pointé". `kindCounts` decrements expense (under unchecked filter). |
| AC-P3 | Toggle line w/ unchecked tx — keep tx | Expense line w/ 2 unchecked allocated tx | Tap PointCircle → "Non, juste la prévision" | Alert shown. Line toggled. Transactions remain unchecked. Toast "Pointé". |
| AC-P4 | Toggle line w/ unchecked tx — check all | Same | Tap "Oui, tout pointer" | Line + all 2 transactions toggled. Toast "Pointé · X.XX CHF". |
| AC-P5 | Soft-delete tx + undo | 1 tx visible | Swipe → Supprimer → Undo within toast window | Tx hidden immediately. Toast "1 transaction supprimée" with Undo. Undo restores tx. No server call. |
| AC-P6 | Soft-delete tx + commit | 1 tx visible | Swipe → Supprimer → wait for toast finish | Server `deleteTransaction` called once. Tx stays gone. |
| AC-P7 | Multi soft-delete shared toast | 1 line + 1 tx in same screen | Delete tx, then delete line within window | Toast updates label to plural ("2 éléments supprimés"). Single Undo restores latest. |
| AC-P8 | Filter persistence | Set typeFilter=.expense + checkedFilter=.checked | Quit app + relaunch + open BudgetDetails | Filters restored. Legacy `pulpe-budget-show-only-unchecked` Bool also synced for widget compat. |
| AC-P9 | Search | 50 lines | Type "loyer" | Only matching lines visible. Free transactions section also filters. Empty state "Aucune prévision trouvée" if none. |
| AC-P10 | All checked empty state | All visible lines + tx are checked, filter `.unchecked` | (no action) | ContentUnavailableView "Tout est pointé" with description "Bien joué !". |
| AC-P11 | Pager month select | 3 budgets in pager | Tap previous month | `prepareNavigation(to:)` swaps `budgetId` synchronously. Skeleton shows if no cache. Network reload. |
| AC-P12 | Auto-pop line detail | On `BudgetLineDetailPage` | Delete the line via menu | After 150ms grace, page pops. Toast with Undo for the deletion. |
| AC-P13 | Auto-pop edit tx | On `EditTransactionPage` | External sync removes the tx | After 150ms grace, page pops. |
| AC-P14 | FX edit | Tx in EUR, user display CHF | Open EditTransactionPage | Currency picker read-only EUR. FX badge shows original amount + rate. Save → conversion applied. |
| AC-P15 | Add allocated tx | On `AddAllocatedTransactionPage` for a CHF line | Enter 42.50 + description, tap Ajouter | Local insert (sync), toast "Transaction ajoutée", page pops. Server create called once. |
| AC-P16 | Reduce Motion | Reduce Motion ON | Toggle a line | No spring animation. `gentleSpring` skipped. Sync indicator still functional. |
| AC-P17 | Amounts hidden | `\.amountsHidden` true | Render hero | Hero amount label = "Montant masqué" via VoiceOver. Numbers replaced by `sensitiveAmount` mask. |
| AC-P18 | 2 decimals everywhere on page | Any line with amount=1234.56 | Inspect | Shown as `1'234.56 CHF` (CHF locale). Never `1'235 CHF`. |
| AC-P19 | Rollover pill tap | Budget with non-zero rollover | Tap "Reporté de mars" pill | Opens `PreviousBudgetSheet(budgetId:)`. |
| AC-P20 | Hero chart tap | Hero rendered | Tap progress chart area | Opens `RealizedBalanceSheet`. Lazy `cachedRealizedMetrics` is computed exactly once on first open. |
| AC-P21 | Optimistic rollback on toggle failure | Network error mocked on toggle | Tap PointCircle | Local toggle reverts. `error` surfaced (banner or alert path TBD — preserve current behavior). |
| AC-P22 | Sync indicator gate | Slow toggle (mock 400ms) | Tap PointCircle | Green sync dot appears after 300ms. Disappears on completion. |
| AC-P23 | Deep link to detail | URL `pulpe://budget/{id}` | Open URL | App opens BudgetDetailsView for that id; resets `budgetPath`. |
| AC-P24 | Deep link to line detail | URL `pulpe://budget/{budgetId}/line/{lineId}` (TBD if exists) | Open URL | If currently supported, must keep working. Otherwise no scope change. |

Each row above MUST have at least one Swift Testing scenario in `PulpeTests/Features/Budgets/BudgetDetails/`. Existing tests cover most of P2/P3/P4/P5/P7/P8 via `BudgetDetailsViewModel*Tests.swift` — those tests must stay green or migrate to the new architecture surface.

### 3.2 Architecture gates (auto-checked)

| ID | Gate | Mechanism |
|---|---|---|
| AC-T1 | No file in `Features/Budgets/BudgetDetails/` exceeds 350 LOC | SwiftLint `file_length` 400 hard error after migration; arch test enumerates files |
| AC-T2 | No `BudgetFormulas.*` reference inside `body` or computed `some View` | SwiftLint custom rule `no_formula_in_view_body` |
| AC-T3 | No `.filter`, `.sorted`, `.map` inside any `body: some View` or computed `some View` of this feature | SwiftLint custom rule `no_collection_ops_in_view_body` (scoped) |
| AC-T4 | `BudgetDetailsView` and pages do NOT contain `appState.budgetPath.append`. They use `router.push(...)` | Arch test grep |
| AC-T5 | `BudgetLineMixedRow` and `BudgetLineDetailTransactionRow` do NOT contain `@Environment(UserSettingsStore.self)` | SwiftLint custom rule `no_user_settings_store_in_row` |
| AC-T6 | `BudgetDetailsViewModel.swift` no longer exists OR is ≤80 LOC orchestrator | Arch test |
| AC-T7 | No `swiftlint:disable file_length` / `type_body_length` in this feature | SwiftLint default + arch test |
| AC-T8 | All mutations route through `BudgetDetailsCoordinator.dispatch(_:)` | Arch test scans for direct calls to `*Service.shared.*` from views |
| AC-T9 | All sheet/push routing goes through `BudgetDetailsRouter` | Arch test + SwiftLint rule |
| AC-T10 | `Task.sleep(for:` in `Features/Budgets/BudgetDetails/` only inside `AutoPopView.swift`, `View+autofocus*.swift` | SwiftLint custom rule |
| AC-T11 | No magic timing literals (300, 150, 200) in feature | SwiftLint custom rule + DesignTokens entries |

### 3.3 Performance gates (Instruments-backed)

Run `python3 .claude/skills/swiftui-expert-skill/scripts/record_trace.py --device 'iPhone 17 Pro Max' --launch Pulpe --output ~/Desktop/budget-details-baseline.trace`, exercise the screen for 20s (open → scroll → toggle 5 lines → switch month → soft-delete 2 → undo → search → close), then `analyze_trace.py`. Compare baseline (pre-refactor) vs target.

| ID | Metric | Target |
|---|---|---|
| AC-Pf1 | Total `calculateConsumption` invocations during scroll | 0 (was N×M per body eval) |
| AC-Pf2 | `swiftui-causes.top_sources` for `BudgetDetailsView` body | NOT in top 10 (was top 3) |
| AC-Pf3 | Median main-thread time per toggle dispatch | ≤ 20ms |
| AC-Pf4 | Hitches during scroll | ≤ 1 hitch / 5s scroll |
| AC-Pf5 | Memory peak across 60s session | ≤ baseline |

---

## 4. Architecture target (recap)

```
View ─reads─▶ BudgetDetailsScreenState (DTO, Equatable)
              ▲
              │ projects from
              │
   ┌──────────┴────────────┐
   │ BudgetDetailsProjector │  (@Observable @MainActor; pure project + observation arming)
   └──────────┬────────────┘
              │ reads
              ▼
   ┌──────────────────────┐
   │ BudgetDataStore      │  (@Observable @MainActor)
   │ FiltersStore         │  (@Observable @MainActor; UserDefaults)
   │ SyncStateStore       │  (@Observable @MainActor)
   │ MutationQueue        │  (@Observable @MainActor; LIFO undo)
   └──────────┬───────────┘
              ▲ mutated by
              │
   ┌──────────┴───────────┐
   │ BudgetDetailsCoordinator │  (@MainActor; dispatch(action:))
   └──────────┬───────────┘
              │ uses
              ▼
   Domain (services as actors, formulas as pure)

Routing:
   BudgetDetailsRouter (@Observable @MainActor) — owns NavigationPath + sheet state.
   AppState.budgetPath stays as deeplink surface; router writes into it.
```

Files (final layout):

```
Features/Budgets/BudgetDetails/
├── State/
│   ├── BudgetDataStore.swift              ≤200
│   ├── FiltersStore.swift                 ≤120
│   ├── SyncStateStore.swift               ≤80
│   └── MutationQueue.swift                ≤180
├── Projection/
│   ├── BudgetDetailsScreenState.swift     ≤220
│   └── BudgetDetailsProjector.swift       ≤300
├── Coordinator/
│   ├── BudgetDetailsAction.swift          ≤80
│   └── BudgetDetailsCoordinator.swift     ≤320
├── Routing/
│   ├── BudgetDetailsRouter.swift          ≤80
│   ├── BudgetLinePushRoute.swift          ≤30
│   └── BudgetDetailDestination.swift      ≤40
├── Views/
│   ├── BudgetDetailsView.swift            ≤180
│   ├── Hero/
│   │   ├── BudgetDetailHero.swift         ≤220
│   │   ├── HeroPillsRow.swift             ≤120
│   │   └── RolloverPill.swift             ≤80
│   ├── Sections/
│   │   ├── BudgetMixedSection.swift       ≤140
│   │   └── BudgetTypeFilter.swift         ≤200
│   ├── Rows/
│   │   ├── BudgetLineMixedRow.swift       ≤300
│   │   ├── BudgetLineDetailTransactionRow.swift ≤80
│   │   └── PointCircle.swift              ≤80
│   ├── Pages/
│   │   ├── BudgetLineDetailPage.swift           ≤180
│   │   ├── AddAllocatedTransactionPage.swift    ≤180
│   │   └── EditTransactionPage.swift            ≤200
│   ├── Pages/Subviews/
│   │   ├── BudgetLineHeroSection.swift     ≤180
│   │   ├── BudgetLineTransactionsSection.swift ≤140
│   │   ├── BudgetLineHeaderMenu.swift      ≤80
│   │   └── BudgetLineEmptyState.swift      ≤80
│   ├── Sheets/
│   │   ├── AddBudgetLineSheet.swift        ≤200
│   │   ├── EditBudgetLineSheet.swift       (untouched if outside)
│   │   ├── PreviousBudgetSheet.swift       (existing)
│   │   └── RealizedBalanceSheet.swift      (existing, lazy realized)
│   └── Skeleton/
│       └── BudgetDetailsSkeletonView.swift (existing)
├── Pager/
│   ├── BudgetMonthPagerBar.swift           (existing)
│   ├── BudgetDetailsScrollTracker.swift    (existing)
│   └── BudgetDetailsStickyPagerLayer.swift (existing)
├── Helpers/
│   ├── AutoPopView.swift                   ≤60
│   └── View+afterPushTransition.swift      ≤80
└── DEBUG/
    ├── BudgetDetailsView+VerifyHarness.swift  (#if DEBUG)
    └── BudgetLineDetailPage+VerifyHarness.swift
```

---

## 5. Phase plan with parallel sub-agent teams

Each phase produces a single PR. Dependencies are explicit so non-blocked phases can run in parallel via Agent teams.

### Phase 0 — Foundation (anti-drift baseline)

**Status**: This PR. Solo (no parallel sub-agents needed; small surface).

**Work**:
- Add custom SwiftLint rules (T2, T3, T9, T10).
- Add `PulpeTests/Architecture/` skeleton with 4 arch tests (T1, T4, T5, T6, T8).
- Add `.claude/rules/00-architecture/budget-details-feature-architecture.md` describing the target pattern.
- Add this plan doc to `ios/docs/`.
- Add `DesignTokens.Sync.indicatorRampDelay` (300ms), `DesignTokens.Animation.autoPopGrace` (150ms), `DesignTokens.Animation.pushAutofocusDelay` (200ms).

**Deliverable**: PR titled `chore(ios): foundation for BudgetDetails refactor (PUL-XXX)` with CI green; arch tests are placeholders that PASS today (assert nothing yet) but compile and run, then become strict per phase.

**Acceptance**:
- `swiftlint --strict` passes.
- `xcodebuild test -only-testing:PulpeTests/Architecture` passes.
- New rules document exists.

### Phase 1 — Router extraction (no behavior change)

**Status**: Pending Phase 0.
**Parallel sub-agent**: 1 (`ios-developer` claims this whole phase). Solo because surface is tightly localized.

**Work**:
1. Create `BudgetDetailsRouter` `@Observable @MainActor` exposing `path: NavigationPath`, `sheet: BudgetDetailDestination?`, `push(_:)`, `present(_:)`, `dismissSheet()`, `popToRoot()`.
2. Provide router via `.environment(router)` from `MainTabView` budget tab.
3. Replace `@State private var destination: BudgetDetailDestination?` in `BudgetDetailsView` with router reads.
4. Replace `appState.budgetPath.append(...)` calls in `BudgetDetailsView` and pages with `router.push(...)`.
5. Keep `appState.budgetPath` as the deeplink surface — `PulpeApp` writes `appState.budgetPath` AND the router observes/syncs (or vice versa: router owns and `AppState.budgetPath` becomes a `Binding`-style proxy). Choose direction — recommend router **owns** the path; `AppState` keeps an alias bound to it for compat.
6. Move `BudgetLinePushRoute` and `BudgetDetailDestination` to `Routing/`.
7. Migrate callers: `BudgetListView` (3 sites), `CurrentMonthView` (1), `PulpeApp` (deeplink), `AppState+SessionReset` (1) — all via router.

**Acceptance (Phase 1)**:
- AC-P11, AC-P12, AC-P13, AC-P19, AC-P20, AC-P23 pass (existing scenarios still work).
- Arch test AC-T4 + AC-T9 enabled.
- No `appState.budgetPath.append` outside the router file (arch test).
- 0 production code outside the router knows about `NavigationPath`.

**Validation gate**: Manual smoke (open detail → push line → push edit tx → back → switch month → deeplink). Existing 1997 LOC of VM tests still green. CI quality + arch tests green.

### Phase 2 — Projector + ScreenState (biggest perf win)

**Status**: Pending Phase 1.
**Parallel sub-agent team**: 3 agents in parallel via `Agent` tool.

- **Agent A (`ios-developer`)**: Implement `BudgetDetailsScreenState.swift` (DTO + nested types) + `BudgetDetailsProjector.swift` (pure `static func project(...)` + observation arming via `withObservationTracking`).
- **Agent B (`ios-developer`)**: Migrate `BudgetDetailsView`, `BudgetMixedSection`, `BudgetLineMixedRow`, `BudgetLineDetailPage`, `BudgetDetailHero` to consume `screenState` instead of computing in body. Rows accept `LineItem` (line + consumption + isSyncing) as input.
- **Agent C (`ios-developer`)**: Add Snapshot tests for `project(...)` covering AC-P1, AC-P5, AC-P6, AC-P10, AC-P19, AC-P20.

Coordination: Agent A produces the types first; Agent B unblocks once types compile (Agent A signals via `SendMessage`); Agent C runs in parallel writing tests against the type signatures.

**Work**:
- DTO `BudgetDetailsScreenState` with `Equatable` conformance.
- Projector reads VM (Phase 2 keeps VM intact — it becomes the source store; Phase 3 splits it).
- Pre-compute `consumptionByLineId: [String: Consumption]` once per source change.
- Pre-compute sections, counts, hero, pagerMonths, free transactions.
- View body becomes `screenState.sections` consumption with **zero** `.filter` / `.map` / `.sorted` / `BudgetFormulas.*`.
- Animation tick counter introduced.

**Acceptance (Phase 2)**:
- AC-P1–AC-P22 all pass.
- AC-T2, AC-T3 enabled in SwiftLint.
- AC-Pf1, AC-Pf2, AC-Pf3 measured via Instruments and recorded in PR description.

**Validation gate**: Run Instruments trace, paste before/after `analyze_trace.py` output in PR. CI green. Manual smoke.

### Phase 3 — Source state split (sub-stores)

**Status**: Pending Phase 2.
**Parallel sub-agent team**: 4 agents in parallel.

- **Agent A**: `BudgetDataStore` (budget + budgetLines + transactions + allBudgets + cache + load/reload/applyDetails/syncCache/invalidateAdjacent).
- **Agent B**: `FiltersStore` (typeFilter + checkedFilter + UserDefaults persistence + migration of legacy Bool key).
- **Agent C**: `SyncStateStore` (syncingBudgetLineIds + syncingTransactionIds + isLoading + error + showCheckAllTransactionsAlert + budgetLineToCheckAll).
- **Agent D**: Wire stores into `BudgetDetailsProjector` (replaces VM reads); update VM to be a thin orchestrator OR delete VM in favor of stores + coordinator (decided in Phase 4).

**Work**:
- Each store is `@Observable @MainActor final class`, ≤ 200 LOC, with focused mutations.
- Migrate VM tests progressively: tests that check filter persistence move to `FiltersStoreTests.swift`; tests that check syncing IDs move to `SyncStateStoreTests.swift`.

**Acceptance (Phase 3)**:
- All product gates AC-P1–AC-P22 still pass.
- VM file ≤ 200 LOC OR removed.
- AC-T1 (file size) tested for new store files.
- Test file count grows (VM test file split per concern).

**Validation gate**: Tests + arch tests + CI green.

### Phase 4 — Action enum + Coordinator (mutation pipeline)

**Status**: Pending Phase 3.
**Parallel sub-agent team**: 3 agents in parallel.

- **Agent A**: Define `BudgetDetailsAction` enum (toggleLine, toggleTransaction, softDeleteTransaction, softDeleteLine, addBudgetLine, addTransaction, updateBudgetLine, updateTransaction, undoLastDeletion, selectMonth, confirmCheckAll(line:checkAll:)).
- **Agent B**: Implement `BudgetDetailsCoordinator.dispatch(_:)` with optimistic + reconcile + rollback. Move all current mutation methods (`toggleBudgetLine`, `confirmToggle`, `addBudgetLine`, etc.) into the coordinator.
- **Agent C**: Migrate views to call `coordinator.dispatch(.toggleLine(line))` instead of VM methods. Remove VM (file deleted; `BudgetDetailsViewModel` symbol no longer exists).

**Work**:
- `BudgetDetailsCoordinator` injected via `.environment(coordinator)`.
- All toast emission centralized (currently scattered between view + VM).
- Animation tick counter increment lives in coordinator.
- Confirm-check alert flow: dispatch returns a typed result; views render the alert; tap "Oui" dispatches `.confirmCheckAll(line:checkAll:true)`.

**Acceptance (Phase 4)**:
- AC-T5, AC-T8 enabled.
- All product gates pass.
- VM file removed (`git mv` or trash).
- All 1997 LOC of legacy VM tests now reference coordinator + stores.

**Validation gate**: Full test suite, arch tests, perf trace re-measure (should match Phase 2 numbers).

### Phase 5 — Subview decomposition + DEBUG isolation

**Status**: Pending Phase 4.
**Parallel sub-agent team**: 3 agents.

- **Agent A**: Decompose `BudgetLineDetailPage` into `BudgetLineHeroSection`, `BudgetLineTransactionsSection`, `BudgetLineHeaderMenu`, `BudgetLineEmptyState`, `AddTransactionCTA`. Add `#Preview` per type.
- **Agent B**: Decompose `BudgetDetailHero` (389 LOC) into `HeroAmountBlock`, `HeroProgressRow`, `HeroPillsRow`, `RolloverPill`. Add previews.
- **Agent C**: Move `PUL209VerifyState` priming + `debugMenuOverlay` from prod files to `DEBUG/` extension files. Extract `AutoPopView` + `View.afterPushTransition(_:)` helper. Replace 200ms / 150ms / 300ms literals with `DesignTokens` entries.

**Acceptance (Phase 5)**:
- AC-T1 (max 350 LOC) enforced as hard SwiftLint error.
- AC-T10 (no Task.sleep outside helpers) enforced.
- AC-T11 (no magic timing literals) enforced.
- DEBUG harness lives only in `DEBUG/` files.

**Validation gate**: Full quality gate. Snapshot tests of each decomposed subview via Preview.

### Phase 6 — Validation pass + sign-off

**Status**: Pending Phase 5.
**Solo (no sub-agents).**

**Work**:
- Run full Instruments trace per AC-Pf1–AC-Pf5; record numbers in `ios/docs/budget-details-perf-baseline.md`.
- Run all 24 product behavior gates manually + automated.
- Run UI regression: launch `PulpeProd` build, capture screenshots, diff against pre-refactor screenshots (PUL-209 verify harness already supports this).
- Update `ios/CLAUDE.md` with the architecture pattern.
- Close the parent Linear issue.

**Acceptance**:
- All AC-P*, AC-T*, AC-Pf* gates green.
- Pixel-identical screenshots vs pre-refactor.
- Documentation updated.

---

## 6. Anti-drift mechanisms (installed in Phase 0, enforced progressively)

### 6.1 SwiftLint custom rules

Added to `ios/.swiftlint.yml`:

```yaml
custom_rules:
  no_formula_in_view_body:
    name: "BudgetFormulas inside view file"
    included: ".*Features/Budgets/BudgetDetails/Views/.*\\.swift"
    regex: "BudgetFormulas\\.(calculate|displayBudgetLines|emotionState)"
    message: "Derivation must live in the projector or a store, not in views."
    severity: error

  no_collection_ops_in_view_body:
    name: "filter/sorted/map in BudgetDetails views"
    included: ".*Features/Budgets/BudgetDetails/Views/.*\\.swift"
    regex: "\\.(filter|sorted|sort)\\("
    message: "Pre-shape data in BudgetDetailsScreenState; views must not transform collections."
    severity: error

  no_user_settings_store_in_row:
    name: "Row reads UserSettingsStore from environment"
    included: ".*Features/Budgets/BudgetDetails/Views/Rows/.*\\.swift"
    regex: "@Environment\\(UserSettingsStore\\.self\\)"
    message: "Rows accept currency as a let primitive; do not read store from environment."
    severity: error

  no_app_state_path_outside_router:
    name: "AppState.budgetPath written outside router"
    excluded: ".*Routing/BudgetDetailsRouter\\.swift"
    regex: "appState\\.budgetPath\\.(append|removeLast)|appState\\.budgetPath\\s*="
    message: "Use BudgetDetailsRouter.push / popToRoot — do not mutate AppState.budgetPath directly."
    severity: error

  no_task_sleep_in_feature:
    name: "Task.sleep outside helpers"
    included: ".*Features/Budgets/BudgetDetails/.*\\.swift"
    excluded:
      - ".*/Helpers/AutoPopView\\.swift"
      - ".*/Helpers/View\\+afterPushTransition\\.swift"
    regex: "Task\\.sleep\\(for:"
    message: "Use AutoPopView or View.afterPushTransition helpers instead of inline Task.sleep."
    severity: error

  no_magic_timing_literals:
    name: "Magic timing literals in BudgetDetails"
    included: ".*Features/Budgets/BudgetDetails/.*\\.swift"
    excluded: ".*/Helpers/.*"
    regex: "milliseconds\\(\\s*(150|200|300)\\s*\\)"
    message: "Promote to DesignTokens.Animation / DesignTokens.Sync."
    severity: error

  no_inline_calculate_in_section:
    name: "calculateConsumption in section render"
    included: ".*Features/Budgets/BudgetDetails/.*Section\\.swift"
    regex: "BudgetFormulas\\.calculateConsumption"
    message: "Consumption must come pre-computed from BudgetDetailsScreenState."
    severity: error

  no_swiftlint_disable_in_feature:
    name: "swiftlint:disable file_length / type_body_length"
    included: ".*Features/Budgets/BudgetDetails/.*\\.swift"
    regex: "swiftlint:disable\\s+(file_length|type_body_length)"
    message: "Files must stay under thresholds; split instead of disabling."
    severity: error
```

Tighter thresholds for this feature path (via `included` overlays):

```yaml
file_length:
  warning: 350
  error: 500

type_body_length:
  warning: 250
  error: 400
```

(Repo-wide stays at current thresholds; this feature has stricter `included`-scoped rule via path-aware lint config or arch test.)

### 6.2 Architecture tests

`PulpeTests/Architecture/BudgetDetailsArchitectureTests.swift` — Swift Testing scenarios that walk the file tree and assert invariants. Keep them as one suite per invariant for clear failure attribution. Run as part of `xcodebuild test` in CI.

Tests:
- `noFileExceeds350Lines`
- `noBudgetFormulasInViewFiles`
- `noFilterSortMapInViewFiles`
- `routerIsSoleAppStateBudgetPathWriter`
- `rowsDoNotReadUserSettingsStore`
- `noViewModelFile` (after Phase 4)
- `coordinatorIsSoleMutationDispatcher`
- `noTaskSleepOutsideHelpers`
- `noSwiftlintDisableInFeature`

### 6.3 Snapshot tests

`PulpeTests/Features/Budgets/BudgetDetails/Projection/BudgetDetailsProjectorSnapshotTests.swift` — pure tests on `project(...)` static func. Cover all AC-P* derivation rules. No UI involvement.

### 6.4 Documentation

- `ios/docs/BUDGET_DETAILS_REFACTOR_PLAN.md` (this file).
- `.claude/rules/00-architecture/budget-details-feature-architecture.md` — pattern doc auto-loaded for any iOS work in this feature.
- `ios/CLAUDE.md` addendum after Phase 6: "When a feature has 5+ mutations + 3+ derivations + persisted filters → apply the BudgetDetails pattern (Stores + Projector + Coordinator + Router)."

### 6.5 CI gate

`pnpm quality` (already runs `swiftlint --strict` if integrated; otherwise add to a `lint:ios` script). Add `xcodebuild test -only-testing:PulpeTests/Architecture` to the iOS test job. Fail build on any violation.

---

## 7. Sub-agent orchestration protocol

For phases 2, 3, 4, 5 (parallelizable):

1. Main agent reads this plan doc, picks the next pending phase.
2. Main agent creates a `Team` via `TeamCreate` named `pul-budget-details-phase-{N}`.
3. Main agent spawns 1-4 `ios-developer` sub-agents (`Agent` tool with `subagent_type: "ios-developer"`), each with a self-contained brief from this doc:
   - Goal (what to deliver)
   - Files to create/modify (exhaustive)
   - Acceptance criteria (subset of AC-P*/AC-T*)
   - Files to NOT touch (boundary)
   - Coordination points (`SendMessage` to peer when contract signed)
4. Sub-agents work in parallel on isolated files.
5. Each sub-agent runs `pnpm quality` + relevant tests on its slice before signaling done.
6. Main agent integrates, runs full quality + arch + perf gates, opens PR.
7. CI runs all gates. Iteration loop until green.

**Iteration loop protocol** (for each phase):

```
loop:
  spawn N sub-agents in parallel for phase tasks
  wait for all to complete
  run: pnpm quality
  run: xcodebuild test -only-testing:PulpeTests/Features/Budgets
  run: xcodebuild test -only-testing:PulpeTests/Architecture
  run: snapshot diff vs pre-phase baseline (if visual)
  if all green and acceptance criteria met:
    open PR, end phase
  else:
    spawn fixer sub-agent with the failure summary
    re-run gates
    repeat
  hard stop after 3 iterations: surface to user
```

---

## 8. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Behavior regression on alert "Pointer les transactions ?" flow | Medium | AC-P3 + AC-P4 covered by integration tests; manual smoke on every phase that touches mutation. |
| Toast undo race conditions with split mutation queue | Medium | `MutationQueue` keeps the LIFO contract; tests AC-P5–P7 cover. |
| Deeplink breaks during router migration | Low | AC-P23 + manual test. `AppState.budgetPath` stays as compat alias bound to router. |
| Snapshot tests too brittle | Low | Snapshot fixtures use TestDataFactory; assert on DTO shape, not pixel rendering. |
| Perf gate fails on simulator vs device | Medium | Run perf trace on physical device too (iPhone 14 minimum). Document delta. |
| Sub-agent generates AnyView/wrong patterns | Medium | Brief includes anti-patterns + reference examples; arch tests catch on integration. |
| Linear issue scope creep | Medium | Each phase = one Linear issue. No cross-phase work. Out-of-scope items documented in `### Follow-up suggestions` only. |

---

## 9. Definition of Done (final, post-Phase 6)

- [ ] All 24 product behavior acceptance criteria pass (manual + automated).
- [ ] All 11 architecture acceptance criteria pass (SwiftLint + arch tests).
- [ ] All 5 performance acceptance criteria pass (Instruments trace).
- [ ] No file in `Features/Budgets/BudgetDetails/` exceeds 350 LOC.
- [ ] `BudgetDetailsViewModel.swift` no longer exists.
- [ ] `pnpm quality` green.
- [ ] `xcodebuild test` green for `PulpeTests` + `PulpeUITests`.
- [ ] `swiftlint --strict` green (no warnings, no errors).
- [ ] Pixel-identical screenshots vs pre-refactor (PUL-209 verify harness).
- [ ] CHANGELOG entry written in technical-only release mode (no whats-new toast — per `feedback_technical_only_releases`).
- [ ] `ios/CLAUDE.md` updated with the new architectural pattern reference.
- [ ] Linear parent issue closed; per-phase issues all closed.

---

## 10. Estimated effort

| Phase | Effort | Calendar |
|---|---|---|
| 0 — Foundation | 0.5 day (this PR) | Same day |
| 1 — Router | 0.5 day | Day 1 |
| 2 — Projector + DTO | 1.5 day | Day 1-2 (parallel) |
| 3 — Sub-stores split | 1 day | Day 3 |
| 4 — Coordinator | 1 day | Day 4 |
| 5 — Subview decomp + DEBUG | 0.5 day | Day 4 |
| 6 — Validation | 0.5 day | Day 5 |
| **Total** | **~5 working days** | |

---

## 11. Out-of-scope follow-ups (for later)

- Apply same pattern to CurrentMonth feature (`CurrentMonthStore` has the same perf shape).
- Apply pattern to BudgetList year overview (similar derivations).
- Migrate `widget` data sync to consume the projector DTO directly via `WidgetDataSyncService`.
- Promote `AutoPopView` + `View.afterPushTransition` into `Shared/Components/` if used in 3+ features.
- Add an architectural `eslint-boundaries`-like enforcer in CI for Swift module boundaries (cross-feature imports forbidden).
- Convert `PUL209VerifyHarness` priming gates to use a typed test harness API rather than DEBUG-only static vars.
