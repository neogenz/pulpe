import Foundation
import OSLog
import WidgetKit

actor WidgetDataSyncService {
    static let shared = WidgetDataSyncService()

    private static let currentMonthWidgetKind = "CurrentMonthWidget"
    private static let yearOverviewWidgetKind = "YearOverviewWidget"

    private let coordinator = WidgetDataCoordinator()
    private let budgetService: BudgetService

    private init(budgetService: BudgetService = .shared) {
        self.budgetService = budgetService
    }

    /// Centralized widget sync. Callers that already hold a fresh `currency` (e.g. right after
    /// `updateCurrency`) can pass it to skip a redundant GET /users/settings.
    func syncAll(payDayOfMonth: Int? = nil, currency: SupportedCurrency? = nil) async {
        let resolvedCurrency: SupportedCurrency
        if let currency {
            resolvedCurrency = currency
        } else {
            (_, resolvedCurrency) = await UserSettingsService.shared.getSettingsWithDefaults(context: "syncAll")
        }

        do {
            let exportData = try await budgetService.exportAllBudgets()

            // Also get current budget details if it exists
            let currentDetails: BudgetDetails?
            if let currentBudget = try? await budgetService.getCurrentMonthBudget(payDayOfMonth: payDayOfMonth) {
                currentDetails = try await budgetService.getBudgetWithDetails(id: currentBudget.id)
            } else {
                currentDetails = nil
            }

            await sync(
                budgetsWithDetails: exportData.budgets,
                currentBudgetDetails: currentDetails,
                payDayOfMonth: payDayOfMonth,
                currency: resolvedCurrency
            )
        } catch {
            Logger.sync.error("syncAll failed - \(error)")
            await sync(
                budgetsWithDetails: [],
                currentBudgetDetails: nil,
                payDayOfMonth: payDayOfMonth,
                currency: resolvedCurrency
            )
        }
    }

    func sync(
        budgetsWithDetails: [BudgetWithDetails],
        currentBudgetDetails: BudgetDetails?,
        payDayOfMonth: Int?,
        currency: SupportedCurrency
    ) async {
        let calendar = Calendar.current
        let currentPeriod = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)

        var currentMonthData: BudgetWidgetData?

        if let details = currentBudgetDetails {
            let metrics = BudgetFormulas.calculateAllMetrics(
                budgetLines: details.budgetLines,
                transactions: details.transactions,
                rollover: details.budget.rollover.orZero
            )

            var components = DateComponents()
            components.month = details.budget.month
            components.year = details.budget.year
            components.day = 1
            let shortMonthName = calendar.date(from: components)
                .map { Formatters.shortMonth.string(from: $0).capitalized } ?? "\(details.budget.month)"

            currentMonthData = BudgetWidgetData(
                id: details.budget.id,
                month: details.budget.month,
                year: details.budget.year,
                available: metrics.remaining,
                monthName: details.budget.monthYear,
                shortMonthName: shortMonthName,
                isCurrentMonth: details.budget.isCurrentPeriod(payDayOfMonth: payDayOfMonth)
            )
        }

        let yearBudgets = buildYearBudgets(
            from: budgetsWithDetails,
            currentPeriod: currentPeriod
        )

        let cache = WidgetDataCache(
            currentMonth: currentMonthData,
            yearBudgets: yearBudgets,
            lastUpdated: Date(),
            currency: currency
        )

        let didSave = coordinator.save(cache)

        guard didSave else {
            Logger.sync.warning("WidgetDataSyncService: failed to save widget cache")
            return
        }

        WidgetCenter.shared.reloadTimelines(ofKind: Self.currentMonthWidgetKind)
        WidgetCenter.shared.reloadTimelines(ofKind: Self.yearOverviewWidgetKind)
    }

    nonisolated private func buildYearBudgets(
        from budgets: [BudgetWithDetails],
        currentPeriod: BudgetPeriod
    ) -> [BudgetWidgetData] {
        let calendar = Calendar.current
        let year = currentPeriod.year
        return (1...12).map { month in
            let budget = budgets.first { $0.month == month && $0.year == year }

            var components = DateComponents()
            components.month = month
            components.year = year
            components.day = 1
            let date = calendar.date(from: components)
            let monthName = date.map { Formatters.monthYear.string(from: $0).capitalized } ?? "\(month)/\(year)"
            let shortMonthName = date.map { Formatters.shortMonth.string(from: $0).capitalized } ?? "\(month)"

            return BudgetWidgetData(
                id: budget?.id ?? "no-budget-\(month)-\(year)",
                month: month,
                year: year,
                available: budget?.remaining,
                monthName: monthName,
                shortMonthName: shortMonthName,
                isCurrentMonth: month == currentPeriod.month
            )
        }
    }
}
