import Foundation

/// Store for dashboard historical data and trends
/// Uses sparse fieldsets API for optimized data fetching (~500 bytes vs ~50KB)
@Observable @MainActor
final class DashboardStore: StoreProtocol {
    // MARK: - State

    private(set) var sparseBudgets: [BudgetSparse] = []
    private(set) var isLoading = false
    private(set) var error: APIError?

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

    // MARK: - Services

    private let budgetService: BudgetService

    // MARK: - Constants

    private static let historicalMonthsCount = 3
    private static let maxBudgetsToFetch = 12 // Enough for YTD + trends

    // MARK: - Initialization

    init(budgetService: BudgetService = .shared, initialBudgets: [BudgetSparse] = []) {
        self.budgetService = budgetService
        self.sparseBudgets = initialBudgets
    }

    // MARK: - Smart Loading (StoreProtocol)

    func loadIfNeeded() async {
        guard !isCacheValid else { return }
        await forceRefresh()
    }

    func forceRefresh() async {
        // Cancel any existing load task to avoid duplicate requests
        loadTask?.cancel()
        
        let task = Task { @MainActor in
            isLoading = true
            error = nil
            defer { isLoading = false }

            do {
                // Fetch only aggregated data - no transactions or budget lines
                let budgets = try await budgetService.getBudgetsSparse(
                    limit: Self.maxBudgetsToFetch
                )

                // Check for cancellation before updating state
                try Task.checkCancellation()

                sparseBudgets = budgets
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
        loadTask = nil
    }

    // MARK: - Computed Properties

    /// Expenses for the last 3 months (including current), sorted oldest to newest
    var historicalExpenses: [MonthlyExpense] {
        let calendar = Calendar.current
        let now = Date()
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        // Get last 3 months (including current)
        var months: [(month: Int, year: Int)] = []
        for offset in (-(Self.historicalMonthsCount - 1)...0) {
            guard let date = calendar.date(byAdding: .month, value: offset, to: now) else { continue }
            let month = calendar.component(.month, from: date)
            let year = calendar.component(.year, from: date)
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
                isCurrentMonth: month == currentMonth && year == currentYear
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

    /// Current rollover (from current month budget)
    var currentRollover: Decimal {
        let calendar = Calendar.current
        let now = Date()
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        return sparseBudgets
            .first { $0.month == currentMonth && $0.year == currentYear }?
            .rollover ?? 0
    }

    /// Check if we have enough historical data for trends
    var hasEnoughHistoryForTrends: Bool {
        historicalExpenses.count >= 2
    }
}

// MARK: - Supporting Types

struct MonthlyExpense: Identifiable {
    let month: Int
    let year: Int
    let total: Decimal
    let isCurrentMonth: Bool

    var id: String { "\(year)-\(month)" }

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
