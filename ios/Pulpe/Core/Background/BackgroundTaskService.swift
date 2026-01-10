import BackgroundTasks
import WidgetKit

actor BackgroundTaskService {
    static let shared = BackgroundTaskService()

    private static let widgetRefreshTaskId = "app.pulpe.ios.widget-refresh"
    private static let minimumBackgroundFetchInterval: TimeInterval = 3600

    private let budgetService = BudgetService.shared

    nonisolated func registerTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.widgetRefreshTaskId,
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else { return }
            Task { await self.handleWidgetRefresh(task: refreshTask) }
        }
    }

    nonisolated func scheduleWidgetRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.widgetRefreshTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: Self.minimumBackgroundFetchInterval)

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("BackgroundTaskService: Failed to schedule widget refresh - \(error)")
        }
    }

    private func handleWidgetRefresh(task: BGAppRefreshTask) async {
        scheduleWidgetRefresh()

        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }

        do {
            try await refreshWidgetData()
            task.setTaskCompleted(success: true)
        } catch {
            task.setTaskCompleted(success: false)
        }
    }

    private func refreshWidgetData() async throws {
        guard await AuthService.shared.hasBiometricTokens() else { return }

        guard let currentBudget = try await budgetService.getCurrentMonthBudget() else {
            await WidgetDataSyncService.shared.sync(budgetsWithDetails: [], currentBudgetDetails: nil)
            return
        }

        let details = try await budgetService.getBudgetWithDetails(id: currentBudget.id)
        let exportData = try? await budgetService.exportAllBudgets()

        await WidgetDataSyncService.shared.sync(
            budgetsWithDetails: exportData?.budgets ?? [],
            currentBudgetDetails: details
        )
    }
}
