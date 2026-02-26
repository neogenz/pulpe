import OSLog
import SwiftUI

/// Coordinates runtime orchestration (scene phase, privacy shield, store refresh, widget sync)
/// so that RootView remains purely declarative.
@Observable @MainActor
final class AppRuntimeCoordinator {
    private(set) var privacyShieldActive = false

    private let appState: AppState
    private let currentMonthStore: CurrentMonthStore
    private let budgetListStore: BudgetListStore
    private let dashboardStore: DashboardStore
    private let widgetSyncViewModel: WidgetSyncViewModel

    init(
        appState: AppState,
        currentMonthStore: CurrentMonthStore,
        budgetListStore: BudgetListStore,
        dashboardStore: DashboardStore,
        widgetSyncViewModel: WidgetSyncViewModel = WidgetSyncViewModel()
    ) {
        self.appState = appState
        self.currentMonthStore = currentMonthStore
        self.budgetListStore = budgetListStore
        self.dashboardStore = dashboardStore
        self.widgetSyncViewModel = widgetSyncViewModel
    }

    func handleScenePhaseChange(from oldPhase: ScenePhase, to newPhase: ScenePhase) {
        // Activate shield only when leaving .active while in a secured state
        if newPhase != .active, oldPhase == .active {
            let isSecured = appState.authState == .authenticated
                || appState.authState == .needsPinEntry
            if isSecured {
                privacyShieldActive = true
            }
        }
        if newPhase == .active {
            privacyShieldActive = false
        }

        if newPhase == .background {
            appState.handleEnterBackground()
            if appState.authState == .authenticated {
                Task { await widgetSyncViewModel.syncWidgetData() }
                BackgroundTaskService.shared.scheduleWidgetRefresh()
            }
        }

        if newPhase == .active, oldPhase != .active {
            appState.prepareForForeground()
            Task {
                await appState.handleEnterForeground()
                if appState.authState == .authenticated {
                    async let r1: Void = currentMonthStore.forceRefresh()
                    async let r2: Void = budgetListStore.forceRefresh()
                    async let r3: Void = dashboardStore.loadIfNeeded()
                    _ = await (r1, r2, r3)
                }
            }
        }
    }

    var shouldShowPrivacyShield: Bool {
        privacyShieldActive || appState.isRestoringSession
    }
}
