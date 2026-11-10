import SwiftUI

extension PulpeApp {
    /// Cross-store wiring, kept out of `init` so the app root stays under the file-length wall.
    static func wireStores(
        _ currentMonthStore: CurrentMonthStore,
        _ budgetListStore: BudgetListStore,
        _ dashboardStore: DashboardStore,
        _ savingsGoalStore: SavingsGoalStore
    ) {
        // Cross-store consistency (PUL-270): any amount-changing mutation on
        // the dashboard marks the sibling stores projecting the same sparse
        // aggregates stale, so their next loadIfNeeded() refetches.
        currentMonthStore.onMutation = { [budgetListStore, dashboardStore] in
            budgetListStore.invalidateCache()
            dashboardStore.invalidateCache()
        }

        // Any goal mutation touching budget data (delete-unlink, create with auto-décomposition, generation-stop freeze/remove) stales every aggregate store (PUL-270).
        savingsGoalStore.onBudgetDataMutation = { [currentMonthStore, budgetListStore, dashboardStore] in
            currentMonthStore.invalidateCache()
            budgetListStore.invalidateCache()
            dashboardStore.invalidateCache()
            BudgetDetailCache.shared.invalidateAll()
        }
    }

    static func wireCurrencyPersistence(_ appState: AppState, _ userSettingsStore: UserSettingsStore) {
        // Wire currency persistence from `OnboardingBootstrapper` to `UserSettingsStore`.
        // Runs after PIN setup completes so the API call carries `X-Client-Key`.
        // Returns `true` only when the store's optimistic update was confirmed by the
        // backend (no error after the await) — bootstrap toasts the user on `false`.
        appState.onboardingBootstrapper.persistCurrency = { [userSettingsStore] currency in
            await userSettingsStore.updateCurrency(currency)
            return userSettingsStore.error == nil
        }
    }
}

/// Harness stand-in for the app root's net-worth stores, so views the later phases touch
/// never miss them.
struct NetWorthStoresModifier: ViewModifier {
    @State private var assetStore = AssetStore()
    @State private var featureFlagsStore = FeatureFlagsStore()

    func body(content: Content) -> some View {
        content.environment(assetStore).environment(featureFlagsStore)
    }
}

extension View {
    func injectingNetWorthStores() -> some View {
        modifier(NetWorthStoresModifier())
    }
}
