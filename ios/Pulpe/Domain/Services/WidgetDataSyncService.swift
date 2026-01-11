import Foundation
import WidgetKit

actor WidgetDataSyncService {
    static let shared = WidgetDataSyncService()

    private static let currentMonthWidgetKind = "CurrentMonthWidget"
    private static let yearOverviewWidgetKind = "YearOverviewWidget"

    private let coordinator = WidgetDataCoordinator()

    func sync(
        budgetsWithDetails: [BudgetWithDetails],
        currentBudgetDetails: BudgetDetails?
    ) {
        let calendar = Calendar.current
        let now = Date()
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        var currentMonthData: BudgetWidgetData?

        if let details = currentBudgetDetails {
            let metrics = BudgetFormulas.calculateAllMetrics(
                budgetLines: details.budgetLines,
                transactions: details.transactions,
                rollover: details.budget.rollover.orZero
            )

            currentMonthData = BudgetWidgetData(
                id: details.budget.id,
                month: details.budget.month,
                year: details.budget.year,
                available: metrics.remaining,
                monthName: details.budget.monthYear,
                isCurrentMonth: details.budget.isCurrentMonth
            )
        }

        let yearBudgets = buildYearBudgets(
            from: budgetsWithDetails,
            forYear: currentYear,
            currentMonth: currentMonth
        )

        let cache = WidgetDataCache(
            currentMonth: currentMonthData,
            yearBudgets: yearBudgets,
            lastUpdated: Date()
        )

        let didSave = coordinator.save(cache)

        guard didSave else { return }

        WidgetCenter.shared.reloadTimelines(ofKind: Self.currentMonthWidgetKind)
        WidgetCenter.shared.reloadTimelines(ofKind: Self.yearOverviewWidgetKind)
    }

    private nonisolated func buildYearBudgets(
        from budgets: [BudgetWithDetails],
        forYear year: Int,
        currentMonth: Int
    ) -> [BudgetWidgetData] {
        return (1...12).map { month in
            let budget = budgets.first { $0.month == month && $0.year == year }

            var components = DateComponents()
            components.month = month
            components.year = year
            components.day = 1
            let monthName = Calendar.current.date(from: components)
                .map { Formatters.monthYear.string(from: $0).capitalized } ?? "\(month)/\(year)"

            return BudgetWidgetData(
                id: budget?.id ?? "placeholder-\(month)-\(year)",
                month: month,
                year: year,
                available: budget?.remaining,
                monthName: monthName,
                isCurrentMonth: month == currentMonth
            )
        }
    }
}
