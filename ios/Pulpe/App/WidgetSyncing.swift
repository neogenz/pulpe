import OSLog
import SwiftUI
import WidgetKit

// MARK: - Protocol

protocol WidgetSyncing: Sendable {
    func purgeDataOutsidePin()
}

// MARK: - Production Implementation

struct WidgetSyncAdapter: WidgetSyncing {
    /// Clears what the widget sync froze outside the PIN: the app-group snapshot and the
    /// Monday recaps it schedules (`WidgetDataSyncService.refreshWeeklyRecaps`).
    func purgeDataOutsidePin() {
        WidgetDataCoordinator().clear()
        WidgetCenter.shared.reloadAllTimelines()
        Task { await NotificationScheduler.shared.cancelWeeklyRecaps() }
    }
}

@Observable @MainActor
final class WidgetSyncViewModel {
    private let budgetService = BudgetService.shared
    private let userSettingsService = UserSettingsService.shared

    func syncWidgetData() async {
        let (payDay, currency) = await userSettingsService.getSettingsWithDefaults(context: "WidgetSyncViewModel")
        guard let currentBudget = try? await budgetService.getCurrentMonthBudget(payDayOfMonth: payDay),
              let details = try? await budgetService.getBudgetWithDetails(id: currentBudget.id) else {
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: [],
                currentBudgetDetails: nil,
                payDayOfMonth: payDay,
                currency: currency
            )
            return
        }

        do {
            let exportData = try await budgetService.exportAllBudgets()
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: exportData.budgets,
                currentBudgetDetails: details,
                payDayOfMonth: payDay,
                currency: currency
            )
        } catch {
            Logger.sync.error("WidgetSyncViewModel: exportAllBudgets failed - \(error)")
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: [],
                currentBudgetDetails: details,
                payDayOfMonth: payDay,
                currency: currency
            )
        }
    }
}
