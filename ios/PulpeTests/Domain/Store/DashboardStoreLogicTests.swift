import XCTest
@testable import Pulpe

/// Tests for DashboardStore computed property logic
/// Creates a real DashboardStore with injected test data to verify actual computed properties
@MainActor
final class DashboardStoreLogicTests: XCTestCase {

    // MARK: - Helpers

    private let calendar = Calendar.current

    private var currentMonth: Int {
        calendar.component(.month, from: Date())
    }

    private var currentYear: Int {
        calendar.component(.year, from: Date())
    }

    private func makeStore(budgets: [BudgetSparse]) -> DashboardStore {
        DashboardStore(initialBudgets: budgets)
    }

    /// Creates a BudgetSparse for a month offset from now (0 = current, -1 = last month, etc.)
    private func sparseBudget(
        monthOffset: Int,
        totalExpenses: Decimal? = nil,
        totalSavings: Decimal? = nil,
        rollover: Decimal? = nil
    ) -> BudgetSparse {
        guard let date = calendar.date(byAdding: .month, value: monthOffset, to: Date()) else {
            fatalError("Invalid month offset: \(monthOffset)")
        }
        let month = calendar.component(.month, from: date)
        let year = calendar.component(.year, from: date)

        return TestDataFactory.createBudgetSparse(
            id: "budget-\(year)-\(month)",
            month: month,
            year: year,
            totalExpenses: totalExpenses,
            totalSavings: totalSavings,
            rollover: rollover
        )
    }

    // MARK: - Historical Expenses

    func testHistoricalExpenses_withAllMonthsPresent_returnsLast3MonthsSortedOldestFirst() {
        // Arrange
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, totalExpenses: 300),
            sparseBudget(monthOffset: -1, totalExpenses: 200),
            sparseBudget(monthOffset: -2, totalExpenses: 100),
        ])

        // Act
        let result = store.historicalExpenses

        // Assert
        XCTAssertEqual(result.count, 3)
        XCTAssertEqual(result[0].total, 100, "Oldest month should be first")
        XCTAssertEqual(result[1].total, 200)
        XCTAssertEqual(result[2].total, 300, "Current month should be last")
        XCTAssertTrue(result[2].isCurrentMonth)
        XCTAssertFalse(result[0].isCurrentMonth)
    }

    func testHistoricalExpenses_withMissingBudget_skipsMonth() {
        // Arrange — only current and 2 months ago, missing last month
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, totalExpenses: 300),
            sparseBudget(monthOffset: -2, totalExpenses: 100),
        ])

        // Act
        let result = store.historicalExpenses

        // Assert
        XCTAssertEqual(result.count, 2, "Should skip the missing month")
        XCTAssertEqual(result[0].total, 100)
        XCTAssertEqual(result[1].total, 300)
    }

    func testHistoricalExpenses_withNilTotalExpenses_defaultsToZero() {
        // Arrange — budget exists but totalExpenses is nil
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, totalExpenses: nil),
        ])

        // Act
        let result = store.historicalExpenses

        // Assert
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result[0].total, 0, "Nil totalExpenses should default to 0")
    }

    func testHistoricalExpenses_withEmptyBudgets_returnsEmpty() {
        let store = makeStore(budgets: [])
        XCTAssertTrue(store.historicalExpenses.isEmpty)
    }

    // MARK: - Expense Variation

    func testExpenseVariation_calculatesCorrectPercentage() {
        // Arrange — 200 last month, 300 this month = +50%
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -2, totalExpenses: 100),
            sparseBudget(monthOffset: -1, totalExpenses: 200),
            sparseBudget(monthOffset: 0, totalExpenses: 300),
        ])

        // Act
        let variation = store.expenseVariation

        // Assert
        XCTAssertNotNil(variation)
        XCTAssertEqual(variation?.amount, 100, "Difference should be 300 - 200 = 100")
        XCTAssertEqual(variation?.percentage ?? 0, 50.0, accuracy: 0.01, "Should be +50%")
        XCTAssertTrue(variation?.isIncrease ?? false)
    }

    func testExpenseVariation_whenPreviousTotalIsZero_returnsNil() {
        // Arrange
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -2, totalExpenses: 0),
            sparseBudget(monthOffset: -1, totalExpenses: 0),
            sparseBudget(monthOffset: 0, totalExpenses: 300),
        ])

        // Act & Assert
        XCTAssertNil(store.expenseVariation, "Should return nil when previous total is 0 to avoid division by zero")
    }

    func testExpenseVariation_withLessThan2Months_returnsNil() {
        // Arrange — only current month
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, totalExpenses: 300),
        ])

        // Act & Assert
        XCTAssertNil(store.expenseVariation, "Cannot compute variation with less than 2 months")
    }

    func testExpenseVariation_withDecrease_showsNegative() {
        // Arrange — 500 last month, 300 this month = -40%
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -2, totalExpenses: 100),
            sparseBudget(monthOffset: -1, totalExpenses: 500),
            sparseBudget(monthOffset: 0, totalExpenses: 300),
        ])

        // Act
        let variation = store.expenseVariation

        // Assert
        XCTAssertNotNil(variation)
        XCTAssertEqual(variation?.amount, -200)
        XCTAssertEqual(variation?.percentage ?? 0, -40.0, accuracy: 0.01)
        XCTAssertFalse(variation?.isIncrease ?? true)
    }

    // MARK: - Savings YTD

    func testSavingsYTD_sumsCurrentYearOnly() {
        // Arrange
        let store = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(id: "1", month: 1, year: currentYear, totalSavings: 100),
            TestDataFactory.createBudgetSparse(id: "2", month: 2, year: currentYear, totalSavings: 200),
            TestDataFactory.createBudgetSparse(id: "3", month: 12, year: currentYear - 1, totalSavings: 999),
        ])

        // Act & Assert
        XCTAssertEqual(store.savingsYTD, 300, "Should only sum current year savings (100 + 200)")
    }

    func testSavingsYTD_withNilSavings_treatsAsZero() {
        // Arrange
        let store = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(id: "1", month: 1, year: currentYear, totalSavings: 100),
            TestDataFactory.createBudgetSparse(id: "2", month: 2, year: currentYear, totalSavings: nil),
        ])

        // Act & Assert
        XCTAssertEqual(store.savingsYTD, 100)
    }

    func testSavingsYTD_withNoBudgets_returnsZero() {
        XCTAssertEqual(makeStore(budgets: []).savingsYTD, 0)
    }

    // MARK: - Current Rollover

    func testCurrentRollover_returnsCurrentMonthValue() {
        // Arrange
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -1, rollover: 999),
            sparseBudget(monthOffset: 0, rollover: 150),
        ])

        // Act & Assert
        XCTAssertEqual(store.currentRollover, 150)
    }

    func testCurrentRollover_whenNoCurrentMonth_returnsZero() {
        // Arrange — only past months
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -1, rollover: 150),
            sparseBudget(monthOffset: -2, rollover: 200),
        ])

        // Act & Assert
        XCTAssertEqual(store.currentRollover, 0)
    }

    func testCurrentRollover_withNilRollover_returnsZero() {
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, rollover: nil),
        ])
        XCTAssertEqual(store.currentRollover, 0)
    }

    // MARK: - Has Enough History for Trends

    func testHasEnoughHistory_with2OrMoreMonths_returnsTrue() {
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -1, totalExpenses: 100),
            sparseBudget(monthOffset: 0, totalExpenses: 200),
        ])
        XCTAssertTrue(store.hasEnoughHistoryForTrends)
    }

    func testHasEnoughHistory_withLessThan2Months_returnsFalse() {
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, totalExpenses: 200),
        ])
        XCTAssertFalse(store.hasEnoughHistoryForTrends)
    }

    func testHasEnoughHistory_withEmptyBudgets_returnsFalse() {
        XCTAssertFalse(makeStore(budgets: []).hasEnoughHistoryForTrends)
    }

    // MARK: - Cache Invalidation Logic

    func testCacheValidation_expiredAfter5Minutes() {
        let lastLoadTime = Date().addingTimeInterval(-301) // 5min + 1s ago
        let cacheValidityDuration: TimeInterval = 300
        let isValid = Date().timeIntervalSince(lastLoadTime) < cacheValidityDuration
        XCTAssertFalse(isValid, "Cache should be invalid after 5 minutes")
    }

    func testCacheValidation_validWithin5Minutes() {
        let lastLoadTime = Date().addingTimeInterval(-60) // 1 minute ago
        let cacheValidityDuration: TimeInterval = 300
        let isValid = Date().timeIntervalSince(lastLoadTime) < cacheValidityDuration
        XCTAssertTrue(isValid, "Cache should be valid within 5 minutes")
    }

    func testCacheValidation_nilLastLoadTime_isInvalid() {
        let lastLoadTime: Date? = nil
        let isValid: Bool = {
            guard let lastLoad = lastLoadTime else { return false }
            return Date().timeIntervalSince(lastLoad) < 300
        }()
        XCTAssertFalse(isValid, "Cache should be invalid when never loaded")
    }
}
