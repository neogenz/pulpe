---
status: pending
---

# Instruction: Asset store, rollout flag and logout reset

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── App/
    │   │   ├── PulpeApp.swift ✏️
    │   │   ├── PulpeApp+StoreWiring.swift ✅
    │   │   ├── SessionDataResetting.swift ✏️
    │   │   ├── BudgetLongPressUITestHarness.swift ✏️
    │   │   └── ContextualCreationUITestHarness.swift ✏️
    │   └── Domain/
    │       └── Store/
    │           ├── AssetStore.swift ✅
    │           └── FeatureFlagsStore.swift ✅
    └── PulpeTests/
        ├── App/
        │   └── SessionDataResetterTests.swift ✏️
        ├── Helpers/
        │   ├── MockAssetService.swift ✅
        │   └── TestDataFactory.swift ✏️
        └── Domain/
            └── Store/
                ├── AssetStoreTests.swift ✅
                └── FeatureFlagsStoreTests.swift ✅
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | `MockAssetService` returning a `NetWorth` fixture from `TestDataFactory` | Store tests run without network | cli |
| Happy path | `loadIfNeeded()` then a second call inside the TTL | One service read; `netWorth` set, `hasLoadedOnce` true | cli |
| Happy path | `create` with a starter category name | Category created first, then the asset with the new id, then one refetch | cli |
| Edge case  | Category created, asset creation fails | The store refetches anyway and rethrows the `APIError` | cli |
| Edge case  | A second write while one is in flight | The second is dropped; one service call | cli |
| Edge case  | `reset()` while a load is in flight | State empty after the load returns; the late result is discarded | cli |
| Edge case  | `LiveSessionDataResetter.resetStores()` | `assetStore.netWorth == nil` | cli |
| Edge case  | `FeatureFlagsStore` with `net_worth` cached `true` in an isolated `UserDefaults` suite and analytics not initialized | `isNetWorthEnabled == true` at init; `refresh()` leaves it untouched | cli |
| Edge case  | Flag off | `AssetStore` is never read: no `GET /v1/assets` at app launch (log check on the simulator) | simulator |

## Tasks to do

### `1)` Make room in `PulpeApp.swift`

> The app root is at 498 lines against the strict 500 wall; free it before adding stores.

1. Move the three cross-store closures of `PulpeApp.init` (`currentMonthStore.onMutation`, `savingsGoalStore.onBudgetDataMutation`, `onboardingBootstrapper.persistCurrency`) into `static func wireStores(...)` in `PulpeApp+StoreWiring.swift`, unchanged; `init` calls it.

### `2)` Rollout flag

> One observable, cached answer to « is `net_worth` on for me ».

1. `FeatureFlagsStore` (`@Observable @MainActor`), restored from `git show c2daf8a260^:ios/Pulpe/Domain/Store/FeatureFlagsStore.swift`: `static let netWorthKey = "net_worth"` documented as the mirror of `FEATURE_FLAGS.NET_WORTH`, `private(set) var isNetWorthEnabled` read from `UserDefaults` key `pulpe.feature_flags.net_worth` at init, `refresh()` that is a no-op while analytics is not initialized, otherwise applies and persists the SDK value, then again in `reloadFeatureFlags`'s completion.
2. `PulpeApp` owns it, injects it with `.environment`, and calls `refresh()` in the root `.task`, on `scenePhase == .active`, and on `.onChange(of: appState.currentUser?.id)` (after `identify`, `AppState+Auth.swift:114-115`).
3. `FeatureFlagsStoreTests` with an isolated `UserDefaults(suiteName:)`.

### `3)` Asset store

> App-scoped cache of `GET /v1/assets`, every write followed by a refetch.

1. `AssetStore: StoreProtocol` on the model of `SavingsGoalStore.swift`: `private(set) var netWorth: NetWorth?`, `isLoading`, `error`, `hasLoadedOnce`, load generation guard, `loadIfNeeded()` on `AppConfiguration.shortCacheValidity`, `forceRefresh()`, `invalidateCache()`, `reset()`.
2. Read helpers, no amount computed: `activeAssets`, `archivedAssets`, `categories`, `totals`, `activeAssets(direction:)`, `inPulpeAccounts(currency:)` (active, `own`, `inPulpe`, matching currency).
3. Writes, each guarded by `isSaving` (a second write is dropped) and followed by `forceRefresh()`, also on failure, then rethrow: `create(_ asset:, category: AssetCategoryChoice)`, `update(id:_:category:)`, `setArchived(id:_:)`, `delete(id:)`, `recordSnapshots(_:)`, `dismissSuggestion(id:)`, `createCategory(name:)`, `renameCategory(id:name:)`, `deleteCategory(id:)`. `AssetCategoryChoice` is `.existing(id)` or `.starter(name)`; a starter is created first, as `net-worth-store.ts#resolveCategory` does. Known gap shared with the web (`net-worth-store.ts:137-143`): if the asset write then fails, the new empty category stays, against « la catégorie n'existe qu'au moment où un élément y est enregistré »; it stays deletable from the categories sheet.
4. `MockAssetService` in `Helpers/` on the model of `MockSavingsGoalService.swift`; `TestDataFactory.makeAsset(...)` and `makeNetWorth(...)`.
5. `AssetStoreTests` per the Test Scope.

### `4)` App wiring and logout

> One instance for the session, emptied at logout.

1. `PulpeApp` creates `AssetStore()`, injects it with `.environment`, and passes it to `LiveSessionDataResetter`.
2. `LiveSessionDataResetter` takes `assetStore` and `featureFlagsStore` and calls `reset()` on both (the flag store clears its `UserDefaults` cache so the next account never inherits `net_worth`; on Local the simulator override must be set again after a logout); `SessionDataResetterTests.liveResetter_resetsAllStores` asserts `assetStore.netWorth == nil`.
3. Inject `AssetStore()` and `FeatureFlagsStore()` in `BudgetLongPressUITestHarness` and `ContextualCreationUITestHarness`, beside their `savingsGoalStore`, so the views later phases touch never miss them.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `PulpeApp.swift` behaves as before; `swiftlint lint --strict` in `ios/` passes with `PulpeApp.swift` under 500 lines |
| 2    | `FeatureFlagsStoreTests` pass; on PulpeLocal the flag reads the cached `UserDefaults` value and never flips back |
| 3    | `AssetStoreTests` pass: TTL, starter category, failure refetch, dropped double write, reset during load |
| 4    | `SessionDataResetterTests` pass; the full `PulpeTests` run (`xcodebuild test ... -scheme PulpeLocal -configuration Local -destination 'platform=iOS Simulator,name=Pulpe Tests' -derivedDataPath <scratchpad>/dd CODE_SIGNING_ALLOWED=NO`) stays green |
