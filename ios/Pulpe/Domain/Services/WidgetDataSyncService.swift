import Foundation
import OSLog
import WidgetKit

actor WidgetDataSyncService {
    static let shared = WidgetDataSyncService()

    private static let currentMonthWidgetKind = "CurrentMonthWidget"
    private static let yearOverviewWidgetKind = "YearOverviewWidget"

    private let coordinator = WidgetDataCoordinator()
    private let budgetService: BudgetService
    private let userSettingsService: any UserSettingsServicing

    init(
        budgetService: BudgetService = .shared,
        userSettingsService: any UserSettingsServicing = UserSettingsService.shared
    ) {
        self.budgetService = budgetService
        self.userSettingsService = userSettingsService
    }

    /// Returns `(payDay, currency)` for a widget sync — explicit caller args win; any missing
    /// value is filled from a single `getSettingsWithDefaults` call (defaulting to `nil` payDay /
    /// `.chf` currency if the settings fetch blips). No settings call when both args are already set.
    func resolveSettings(
        payDayOfMonth: Int?,
        currency: SupportedCurrency?
    ) async -> (payDayOfMonth: Int?, currency: SupportedCurrency) {
        if let payDayOfMonth, let currency {
            return (payDayOfMonth, currency)
        }
        let (fetchedPayDay, fetchedCurrency) = await userSettingsService.getSettingsWithDefaults(context: "syncAll")
        return (payDayOfMonth ?? fetchedPayDay, currency ?? fetchedCurrency)
    }

    /// Centralized widget sync. Callers that already hold a fresh `payDayOfMonth`/`currency`
    /// (e.g. right after `updateCurrency`) can pass them to skip a redundant GET /users/settings.
    func syncAll(payDayOfMonth: Int? = nil, currency: SupportedCurrency? = nil) async {
        let resolved = await resolveSettings(payDayOfMonth: payDayOfMonth, currency: currency)
        let resolvedPayDay = resolved.payDayOfMonth
        let resolvedCurrency = resolved.currency

        // Fetch current month details first; preserve them on year-export failure
        // so a transient `exportAllBudgets` error doesn't blank the current-month widget.
        var currentDetails: BudgetDetails?
        if let currentBudget = try? await budgetService.getCurrentMonthBudget(payDayOfMonth: resolvedPayDay) {
            currentDetails = try? await budgetService.getBudgetWithDetails(id: currentBudget.id)
        }

        do {
            let exportData = try await budgetService.exportAllBudgets()
            await sync(
                budgetsWithDetails: exportData.budgets,
                currentBudgetDetails: currentDetails,
                payDayOfMonth: resolvedPayDay,
                currency: resolvedCurrency
            )
        } catch {
            Logger.sync.error("syncAll failed - \(error)")
            await sync(
                budgetsWithDetails: [],
                currentBudgetDetails: currentDetails,
                payDayOfMonth: resolvedPayDay,
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
            currency: currency,
            payDayOfMonth: payDayOfMonth
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
