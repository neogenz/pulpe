import OSLog
import SwiftUI
import WidgetKit

// MARK: - Protocol

protocol WidgetSyncing: Sendable {
    func clearAndReload()
}

// MARK: - Production Implementation

struct WidgetSyncAdapter: WidgetSyncing {
    func clearAndReload() {
        WidgetDataCoordinator().clear()
        WidgetCenter.shared.reloadAllTimelines()
    }
}

@Observable @MainActor
final class WidgetSyncViewModel {
    private let budgetService = BudgetService.shared
    private let userSettingsService = UserSettingsService.shared

    func syncWidgetData() async {
        let payDay = try? await userSettingsService.getSettings().payDayOfMonth
        guard let currentBudget = try? await budgetService.getCurrentMonthBudget(payDayOfMonth: payDay),
              let details = try? await budgetService.getBudgetWithDetails(id: currentBudget.id) else {
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: [],
                currentBudgetDetails: nil,
                payDayOfMonth: payDay
            )
            return
        }

        do {
            let exportData = try await budgetService.exportAllBudgets()
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: exportData.budgets,
                currentBudgetDetails: details,
                payDayOfMonth: payDay
            )
        } catch {
            Logger.sync.error("WidgetSyncViewModel: exportAllBudgets failed - \(error)")
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: [],
                currentBudgetDetails: details,
                payDayOfMonth: payDay
            )
        }
    }
}
