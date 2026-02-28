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
        #if DEBUG
        let oldDesc = String(describing: oldPhase)
        let newDesc = String(describing: newPhase)
        let authDesc = String(describing: self.appState.authState)
        Logger.auth.debug(
            "[AUTH_SCENE] \(oldDesc, privacy: .public) → \(newDesc, privacy: .public) \(authDesc, privacy: .public)"
        )
        #endif
        // Activate shield only when truly entering background (not on notification/control center)
        if newPhase == .background, oldPhase != .background {
            activatePrivacyShieldIfNeeded()
        }
        if newPhase == .active {
            withAnimation(.easeInOut(duration: 0.25)) {
                privacyShieldActive = false
            }
            // Only fire app_opened when returning from background (not notification center dismiss).
            // Cold start is captured in AnalyticsService.initialize().
            if oldPhase == .background {
                AnalyticsService.shared.capture(.appOpened)
            }
        }

        if newPhase == .background {
            handleEnterBackground()
        }

        if newPhase == .active, oldPhase != .active {
            handleBecomeActive()
        }
    }

    private func activatePrivacyShieldIfNeeded() {
        let isSecured = appState.authState == .authenticated
            || appState.authState == .needsPinEntry
        if isSecured {
            privacyShieldActive = true
            #if DEBUG
            Logger.auth.debug("[AUTH_SCENE] privacy shield activated (secured=\(isSecured))")
            #endif
        }
    }

    private func handleEnterBackground() {
        AnalyticsService.shared.flush()
        appState.handleEnterBackground()
        if appState.authState == .authenticated {
            Task { await widgetSyncViewModel.syncWidgetData() }
            BackgroundTaskService.shared.scheduleWidgetRefresh()
        }
    }

    private func handleBecomeActive() {
        appState.prepareForForeground()
        Task {
            await appState.handleEnterForeground()
            #if DEBUG
            let fgAuth = String(describing: self.appState.authState)
            let refreshing = self.appState.authState == .authenticated
            Logger.auth.debug(
                "[AUTH_SCENE] foreground handled, auth=\(fgAuth, privacy: .public) refreshing=\(refreshing)"
            )
            #endif
            if appState.authState == .authenticated {
                async let r1: Void = currentMonthStore.forceRefresh()
                async let r2: Void = budgetListStore.forceRefresh()
                async let r3: Void = dashboardStore.loadIfNeeded()
                _ = await (r1, r2, r3)
            }
        }
    }

    var shouldShowPrivacyShield: Bool {
        privacyShieldActive || appState.isRestoringSession
    }
}
