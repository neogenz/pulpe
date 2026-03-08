import Foundation

/// Store for dashboard historical data and trends
/// Uses sparse fieldsets API for optimized data fetching (~500 bytes vs ~50KB)
@Observable @MainActor
final class DashboardStore: StoreProtocol {
    // MARK: - State

    private(set) var sparseBudgets: [BudgetSparse] = []
    private(set) var isLoading = false
    private(set) var error: APIError?
    private(set) var payDayOfMonth: Int?

    /// Returns true if the store has an error and no data to display
    var hasError: Bool {
        error != nil && sparseBudgets.isEmpty
    }

    // MARK: - Cache Metadata

    private var lastLoadTime: Date?

    private var isCacheValid: Bool {
        guard let lastLoad = lastLoadTime else { return false }
        return Date().timeIntervalSince(lastLoad) < AppConfiguration.longCacheValidity
    }

    /// Coalescing task to prevent concurrent API loads
    private var loadTask: Task<Void, Never>?
    /// Generation counter to safely nil loadTask after completion
    private var loadGeneration = 0

    // MARK: - Services

    private let budgetService: BudgetService

    // MARK: - Constants

    private static let historicalMonthsCount = 3
    private static let maxHistoricalToFetch = 6 // Enough for trends + YTD lookback

    // MARK: - Initialization

    init(budgetService: BudgetService = .shared, initialBudgets: [BudgetSparse] = []) {
        self.budgetService = budgetService
        self.sparseBudgets = initialBudgets
    }

    // MARK: - Smart Loading (StoreProtocol)

    /// Invalidates the cache so the next `loadIfNeeded()` will re-fetch.
    func invalidateCache() {
        lastLoadTime = nil
    }

    func loadIfNeeded() async {
        guard !isCacheValid else { return }
        await forceRefresh()
    }

    func setPayDay(_ payDay: Int?) {
        payDayOfMonth = payDay
    }

    func reset() {
        loadTask?.cancel()
        loadTask = nil
        loadGeneration = 0
        sparseBudgets = []
        lastLoadTime = nil
        error = nil
    }

    func forceRefresh() async {
        // Cancel any existing load task to avoid duplicate requests
        loadTask?.cancel()

        loadGeneration += 1
        let currentGeneration = loadGeneration

        let task = Task {
            isLoading = true
            error = nil
            defer { isLoading = false }

            do {
                let currentYear = Calendar.current.component(.year, from: Date())

                // Fetch current year (all months including future) + recent history in parallel
                async let currentYearBudgets = budgetService.getBudgetsSparse(year: currentYear)
                async let recentBudgets = budgetService.getBudgetsSparse(
                    limit: Self.maxHistoricalToFetch,
                    year: currentYear - 1
                )

                let (yearBudgets, pastBudgets) = try await (currentYearBudgets, recentBudgets)

                // Check for cancellation before updating state
                try Task.checkCancellation()

                // Merge and deduplicate by id
                var seen = Set<String>()
                var merged: [BudgetSparse] = []
                for budget in pastBudgets + yearBudgets where seen.insert(budget.id).inserted {
                    merged.append(budget)
                }

                sparseBudgets = merged
                lastLoadTime = Date()
            } catch is CancellationError {
                // Task was cancelled, don't update error state
            } catch let apiError as APIError {
                self.error = apiError
            } catch {
                self.error = .networkError(error)
            }
        }

        loadTask = task
        await task.value
        if loadGeneration == currentGeneration { loadTask = nil }
    }

    // MARK: - Computed Properties

    /// Expenses for the last 3 months (including current), sorted oldest to newest
    var historicalExpenses: [MonthlyExpense] {
        let currentPeriod = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)

        // Build last 3 months from budget period (not calendar), so payday shifts are respected
        var months: [(month: Int, year: Int)] = []
        for offset in (-(Self.historicalMonthsCount - 1)...0) {
            var month = currentPeriod.month + offset
            var year = currentPeriod.year
            while month < 1 { month += 12; year -= 1 }
            months.append((month, year))
        }

        return months.compactMap { (month, year) -> MonthlyExpense? in
            guard let budget = sparseBudgets.first(where: { $0.month == month && $0.year == year }) else {
                return nil
            }

            // Use pre-calculated aggregate from backend
            let totalExpenses = budget.totalExpenses ?? 0

            return MonthlyExpense(
                month: month,
                year: year,
                total: totalExpenses,
                isCurrentPeriod: month == currentPeriod.month && year == currentPeriod.year
            )
        }
    }

    /// Variation compared to previous month
    var expenseVariation: ExpenseVariation? {
        let expenses = historicalExpenses
        guard expenses.count >= 2,
              let current = expenses.last,
              let previous = expenses.dropLast().last else { return nil }

        guard previous.total > 0 else { return nil }

        let difference = current.total - previous.total
        let percentage = (difference as NSDecimalNumber)
            .dividing(by: previous.total as NSDecimalNumber)
            .multiplying(by: 100)
            .doubleValue

        return ExpenseVariation(
            amount: difference,
            percentage: percentage,
            previousMonth: previous.month,
            previousYear: previous.year
        )
    }

    /// Total savings for current year (Year-To-Date)
    var savingsYTD: Decimal {
        let calendar = Calendar.current
        let currentYear = calendar.component(.year, from: Date())

        // Use pre-calculated aggregates from backend
        return sparseBudgets
            .filter { $0.year == currentYear }
            .reduce(Decimal.zero) { total, budget in
                total + (budget.totalSavings ?? 0)
            }
    }

    /// Current rollover (from current period budget)
    var currentRollover: Decimal {
        let currentPeriod = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)

        return sparseBudgets
            .first { $0.month == currentPeriod.month && $0.year == currentPeriod.year }?
            .rollover ?? 0
    }

    /// Check if we have enough historical data for trends
    var hasEnoughHistoryForTrends: Bool {
        historicalExpenses.count >= 2
    }

    /// Projected remaining balance from current month through December.
    /// Uses the backend-computed `remaining` field (income + rollover - expenses)
    /// to match the "disponible" amounts shown in the budget list.
    var balanceForecasts: [MonthlyForecast] {
        let currentPeriod = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)
        let currentYear = currentPeriod.year

        return (currentPeriod.month...12).compactMap { month -> MonthlyForecast? in
            guard let budget = sparseBudgets.first(where: { $0.month == month && $0.year == currentYear }),
                  let remaining = budget.remaining else {
                return nil
            }

            return MonthlyForecast(
                month: month,
                year: currentYear,
                availableBalance: Double(truncating: remaining as NSDecimalNumber),
                isCurrentMonth: month == currentPeriod.month
            )
        }
    }

    /// At least 2 forecast entries needed for a meaningful chart
    var hasEnoughDataForBalanceChart: Bool {
        balanceForecasts.count >= 2
    }
}

// MARK: - Supporting Types

protocol MonthlyDataPoint {
    var month: Int { get }
    var year: Int { get }
}

extension MonthlyDataPoint {
    var shortMonthName: String {
        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1

        if let date = Calendar.current.date(from: components) {
            return Formatters.shortMonth.string(from: date).capitalized
        }
        return "\(month)"
    }
}

struct MonthlyExpense: Identifiable, MonthlyDataPoint {
    let month: Int
    let year: Int
    let total: Decimal
    let isCurrentPeriod: Bool

    var id: String { "\(year)-\(month)" }
}

struct ExpenseVariation {
    let amount: Decimal
    let percentage: Double
    let previousMonth: Int
    let previousYear: Int

    var isIncrease: Bool { amount > 0 }

    var previousMonthName: String {
        var components = DateComponents()
        components.month = previousMonth
        components.year = previousYear
        components.day = 1

        if let date = Calendar.current.date(from: components) {
            return Formatters.month.string(from: date).lowercased()
        }
        return "\(previousMonth)"
    }

    var formattedPercentage: String {
        let sign = isIncrease ? "+" : ""
        return "\(sign)\(Int(percentage))%"
    }
}

struct MonthlyForecast: Identifiable, MonthlyDataPoint {
    let month: Int
    let year: Int
    let availableBalance: Double
    let isCurrentMonth: Bool

    var id: String { "\(year)-\(month)" }
}
