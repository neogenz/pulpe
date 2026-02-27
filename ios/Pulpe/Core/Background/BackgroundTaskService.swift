import BackgroundTasks
import OSLog
import WidgetKit

actor BackgroundTaskService {
    static let shared = BackgroundTaskService()

    private static let widgetRefreshTaskId = "app.pulpe.ios.widget-refresh"
    private static let minimumBackgroundFetchInterval: TimeInterval = 3600

    private let budgetService = BudgetService.shared
    private let userSettingsService = UserSettingsService.shared

    nonisolated func registerTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.widgetRefreshTaskId,
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else { return }
            // BGAppRefreshTask is not Sendable, but BGTaskScheduler guarantees
            // the handler runs on the main queue, so we can safely capture it.
            nonisolated(unsafe) let unsafeTask = refreshTask
            Task { await BackgroundTaskService.shared.handleWidgetRefresh(task: unsafeTask) }
        }
    }

    nonisolated func scheduleWidgetRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.widgetRefreshTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: Self.minimumBackgroundFetchInterval)

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            Logger.sync.error("BackgroundTaskService: Failed to schedule widget refresh - \(error)")
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

        let payDay = try? await userSettingsService.getSettings().payDayOfMonth

        guard let currentBudget = try await budgetService.getCurrentMonthBudget(payDayOfMonth: payDay) else {
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: [],
                currentBudgetDetails: nil,
                payDayOfMonth: payDay
            )
            return
        }

        let details = try await budgetService.getBudgetWithDetails(id: currentBudget.id)

        do {
            let exportData = try await budgetService.exportAllBudgets()
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: exportData.budgets,
                currentBudgetDetails: details,
                payDayOfMonth: payDay
            )
        } catch {
            Logger.sync.error("BackgroundTaskService: exportAllBudgets failed - \(error)")
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: [],
                currentBudgetDetails: details,
                payDayOfMonth: payDay
            )
        }
    }
}
