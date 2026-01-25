import Foundation

/// Store for dashboard historical data and trends
@Observable @MainActor
final class DashboardStore: StoreProtocol {
    // MARK: - State

    private(set) var budgetsWithDetails: [BudgetWithDetails] = []
    private(set) var isLoading = false
    private(set) var error: Error?

    // MARK: - Cache Metadata

    private var lastLoadTime: Date?
    private static let cacheValidityDuration: TimeInterval = 60 // 1 minute for dashboard

    private var isCacheValid: Bool {
        guard let lastLoad = lastLoadTime else { return false }
        return Date().timeIntervalSince(lastLoad) < Self.cacheValidityDuration
    }

    // MARK: - Services

    private let budgetService: BudgetService

    // MARK: - Initialization

    init(budgetService: BudgetService = .shared) {
        self.budgetService = budgetService
    }

    // MARK: - Smart Loading (StoreProtocol)

    func loadIfNeeded() async {
        guard !isCacheValid else { return }
        await forceRefresh()
    }

    func forceRefresh() async {
        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let exportData = try await budgetService.exportAllBudgets()
            budgetsWithDetails = exportData.budgets
            lastLoadTime = Date()
        } catch {
            self.error = error
        }
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
        for offset in (-2...0) {
            guard let date = calendar.date(byAdding: .month, value: offset, to: now) else { continue }
            let month = calendar.component(.month, from: date)
            let year = calendar.component(.year, from: date)
            months.append((month, year))
        }

        return months.compactMap { (month, year) -> MonthlyExpense? in
            guard let budget = budgetsWithDetails.first(where: { $0.month == month && $0.year == year }) else {
                return nil
            }

            let totalExpenses = BudgetFormulas.calculateTotalExpenses(
                budgetLines: budget.budgetLines,
                transactions: budget.transactions
            )

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
        let percentage = (Double(truncating: difference as NSDecimalNumber) / Double(truncating: previous.total as NSDecimalNumber)) * 100

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

        return budgetsWithDetails
            .filter { $0.year == currentYear }
            .reduce(Decimal.zero) { total, budget in
                total + BudgetFormulas.calculateTotalSavings(
                    budgetLines: budget.budgetLines,
                    transactions: budget.transactions
                )
            }
    }

    /// Current rollover (from current month budget)
    var currentRollover: Decimal {
        let calendar = Calendar.current
        let now = Date()
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        return budgetsWithDetails
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
