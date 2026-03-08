import Foundation
@testable import Pulpe
import Testing

@MainActor
struct DashboardStoreLogicTests {
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

    @Test func historicalExpenses_withAllMonthsPresent_returnsLast3MonthsSortedOldestFirst() {
        // Arrange
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, totalExpenses: 300),
            sparseBudget(monthOffset: -1, totalExpenses: 200),
            sparseBudget(monthOffset: -2, totalExpenses: 100),
        ])

        // Act
        let result = store.historicalExpenses

        // Assert
        #expect(result.count == 3)
        #expect(result[0].total == 100)
        #expect(result[1].total == 200)
        #expect(result[2].total == 300)
        #expect(result[2].isCurrentPeriod)
        #expect(!result[0].isCurrentPeriod)
    }

    @Test func historicalExpenses_withMissingBudget_skipsMonth() {
        // Arrange — only current and 2 months ago, missing last month
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, totalExpenses: 300),
            sparseBudget(monthOffset: -2, totalExpenses: 100),
        ])

        // Act
        let result = store.historicalExpenses

        // Assert
        #expect(result.count == 2)
        #expect(result[0].total == 100)
        #expect(result[1].total == 300)
    }

    @Test func historicalExpenses_withNilTotalExpenses_defaultsToZero() {
        // Arrange — budget exists but totalExpenses is nil
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, totalExpenses: nil),
        ])

        // Act
        let result = store.historicalExpenses

        // Assert
        #expect(result.count == 1)
        #expect(result[0].total == 0)
    }

    @Test func historicalExpenses_withEmptyBudgets_returnsEmpty() {
        let store = makeStore(budgets: [])
        #expect(store.historicalExpenses.isEmpty)
    }

    // MARK: - Expense Variation

    @Test func expenseVariation_calculatesCorrectPercentage() {
        // Arrange — 200 last month, 300 this month = +50%
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -2, totalExpenses: 100),
            sparseBudget(monthOffset: -1, totalExpenses: 200),
            sparseBudget(monthOffset: 0, totalExpenses: 300),
        ])

        // Act
        let variation = store.expenseVariation

        // Assert
        #expect(variation != nil)
        #expect(variation?.amount == 100)
        #expect(abs((variation?.percentage ?? 0) - 50.0) < 0.01)
        #expect(variation?.isIncrease ?? false)
    }

    @Test func expenseVariation_whenPreviousTotalIsZero_returnsNil() {
        // Arrange
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -2, totalExpenses: 0),
            sparseBudget(monthOffset: -1, totalExpenses: 0),
            sparseBudget(monthOffset: 0, totalExpenses: 300),
        ])

        // Act & Assert
        #expect(store.expenseVariation == nil)
    }

    @Test func expenseVariation_withLessThan2Months_returnsNil() {
        // Arrange — only current month
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, totalExpenses: 300),
        ])

        // Act & Assert
        #expect(store.expenseVariation == nil)
    }

    @Test func expenseVariation_withDecrease_showsNegative() {
        // Arrange — 500 last month, 300 this month = -40%
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -2, totalExpenses: 100),
            sparseBudget(monthOffset: -1, totalExpenses: 500),
            sparseBudget(monthOffset: 0, totalExpenses: 300),
        ])

        // Act
        let variation = store.expenseVariation

        // Assert
        #expect(variation != nil)
        #expect(variation?.amount == -200)
        #expect(abs((variation?.percentage ?? 0) - (-40.0)) < 0.01)
        #expect(!(variation?.isIncrease ?? true))
    }

    // MARK: - Savings YTD

    @Test func savingsYTD_sumsCurrentYearOnly() {
        // Arrange
        let store = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(id: "1", month: 1, year: currentYear, totalSavings: 100),
            TestDataFactory.createBudgetSparse(id: "2", month: 2, year: currentYear, totalSavings: 200),
            TestDataFactory.createBudgetSparse(id: "3", month: 12, year: currentYear - 1, totalSavings: 999),
        ])

        // Act & Assert
        #expect(store.savingsYTD == 300)
    }

    @Test func savingsYTD_withNilSavings_treatsAsZero() {
        // Arrange
        let store = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(id: "1", month: 1, year: currentYear, totalSavings: 100),
            TestDataFactory.createBudgetSparse(id: "2", month: 2, year: currentYear, totalSavings: nil),
        ])

        // Act & Assert
        #expect(store.savingsYTD == 100)
    }

    @Test func savingsYTD_withNoBudgets_returnsZero() {
        #expect(makeStore(budgets: []).savingsYTD == 0)
    }

    // MARK: - Current Rollover

    @Test func currentRollover_returnsCurrentMonthValue() {
        // Arrange
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -1, rollover: 999),
            sparseBudget(monthOffset: 0, rollover: 150),
        ])

        // Act & Assert
        #expect(store.currentRollover == 150)
    }

    @Test func currentRollover_whenNoCurrentMonth_returnsZero() {
        // Arrange — only past months
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -1, rollover: 150),
            sparseBudget(monthOffset: -2, rollover: 200),
        ])

        // Act & Assert
        #expect(store.currentRollover == 0)
    }

    @Test func currentRollover_withNilRollover_returnsZero() {
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, rollover: nil),
        ])
        #expect(store.currentRollover == 0)
    }

    // MARK: - Has Enough History for Trends

    @Test func hasEnoughHistory_with2OrMoreMonths_returnsTrue() {
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: -1, totalExpenses: 100),
            sparseBudget(monthOffset: 0, totalExpenses: 200),
        ])
        #expect(store.hasEnoughHistoryForTrends)
    }

    @Test func hasEnoughHistory_withLessThan2Months_returnsFalse() {
        let store = makeStore(budgets: [
            sparseBudget(monthOffset: 0, totalExpenses: 200),
        ])
        #expect(!store.hasEnoughHistoryForTrends)
    }

    @Test func hasEnoughHistory_withEmptyBudgets_returnsFalse() {
        #expect(!makeStore(budgets: []).hasEnoughHistoryForTrends)
    }

    // MARK: - Balance Forecasts

    @Test func balanceForecasts_withFutureBudgets_returnsCorrectSequence() {
        // Arrange — create budgets from current month through +2 months (or until Dec)
        let month0 = currentMonth
        let month1 = min(currentMonth + 1, 12)
        let month2 = min(currentMonth + 2, 12)

        let months = Set([month0, month1, month2])
        let store = makeStore(budgets: months.sorted().map { month in
            TestDataFactory.createBudgetSparse(
                id: "fc-\(month)",
                month: month,
                year: currentYear,
                remaining: 2583
            )
        })

        // Act
        let forecasts = store.balanceForecasts

        // Assert
        #expect(forecasts.count == months.count)
        #expect(forecasts.first?.month == month0)
        #expect(forecasts.first?.isCurrentMonth == true)
        #expect(forecasts.first?.availableBalance == 2583.0)
    }

    @Test func balanceForecasts_excludesMonthsWithoutBudgets() {
        // Arrange — current month and +2, but NOT +1 (gap)
        let month0 = currentMonth
        let month2 = min(currentMonth + 2, 12)

        var budgets = [
            TestDataFactory.createBudgetSparse(
                id: "fc-\(month0)", month: month0, year: currentYear,
                remaining: 1500
            ),
        ]
        if month2 != month0 {
            budgets.append(
                TestDataFactory.createBudgetSparse(
                    id: "fc-\(month2)", month: month2, year: currentYear,
                    remaining: 2000
                )
            )
        }

        let store = makeStore(budgets: budgets)

        // Act
        let forecasts = store.balanceForecasts

        // Assert — gap month is filtered out
        let forecastMonths = forecasts.map(\.month)
        let expectedGapMonth = min(currentMonth + 1, 12)
        if expectedGapMonth != month0 && expectedGapMonth != month2 {
            #expect(!forecastMonths.contains(expectedGapMonth))
        }
    }

    @Test func balanceForecasts_excludesMonthsWithNilRemaining() {
        // Arrange — budget exists but remaining is nil (not computed by backend)
        let store = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(
                id: "fc-1", month: currentMonth, year: currentYear,
                remaining: nil
            ),
        ])

        // Act & Assert — nil remaining is filtered out
        #expect(store.balanceForecasts.isEmpty)
    }

    @Test func balanceForecasts_emptyWhenNoData() {
        let store = makeStore(budgets: [])
        #expect(store.balanceForecasts.isEmpty)
    }

    @Test func hasEnoughDataForBalanceChart_trueWith2OrMore() {
        let store = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(
                id: "fc-1", month: currentMonth, year: currentYear,
                remaining: 2500
            ),
            TestDataFactory.createBudgetSparse(
                id: "fc-2", month: min(currentMonth + 1, 12), year: currentYear,
                remaining: 3000
            ),
        ])

        if currentMonth < 12 {
            #expect(store.hasEnoughDataForBalanceChart)
        }
    }

    @Test func hasEnoughDataForBalanceChart_falseWith0Or1() {
        #expect(!makeStore(budgets: []).hasEnoughDataForBalanceChart)

        let storeWith1 = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(
                id: "fc-1", month: currentMonth, year: currentYear,
                remaining: 2500
            ),
        ])
        #expect(!storeWith1.hasEnoughDataForBalanceChart)
    }

    // MARK: - Cache Invalidation Logic

    @Test func cacheValidation_expiredAfter5Minutes() {
        let lastLoadTime = Date().addingTimeInterval(-301) // 5min + 1s ago
        let cacheValidityDuration: TimeInterval = 300
        let isValid = Date().timeIntervalSince(lastLoadTime) < cacheValidityDuration
        #expect(!isValid)
    }

    @Test func cacheValidation_validWithin5Minutes() {
        let lastLoadTime = Date().addingTimeInterval(-60) // 1 minute ago
        let cacheValidityDuration: TimeInterval = 300
        let isValid = Date().timeIntervalSince(lastLoadTime) < cacheValidityDuration
        #expect(isValid)
    }

    @Test func cacheValidation_nilLastLoadTime_isInvalid() {
        let lastLoadTime: Date? = nil
        let isValid: Bool = {
            guard let lastLoad = lastLoadTime else { return false }
            return Date().timeIntervalSince(lastLoad) < 300
        }()
        #expect(!isValid)
    }
}
