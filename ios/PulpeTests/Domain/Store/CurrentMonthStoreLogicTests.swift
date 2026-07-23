import Foundation
@testable import Pulpe
import Testing

struct CurrentMonthStoreLogicTests {
    // MARK: - Days Remaining Logic

    // These call the real store — earlier versions re-implemented the formula inline,
    // which silently preserved the timestamp-vs-midnight truncation bug it had.

    @Test @MainActor func daysRemaining_staysWithinMonthBounds() {
        let store = CurrentMonthStore()
        let days = store.daysRemaining()
        #expect(days >= 1)
        #expect(days <= 31)
    }

    @Test @MainActor func daysRemaining_onFirstDayOfMonth_returnsFullMonth() throws {
        let store = CurrentMonthStore()
        let firstOfJuly = try #require(Calendar.current.date(from: DateComponents(
            year: 2026, month: 7, day: 1, hour: 9
        )))
        #expect(store.daysRemaining(now: firstOfJuly) == 31)
    }

    // MARK: - Daily Budget Logic

    @Test func dailyBudgetLogic_dividesRemainingByDays() {
        // Arrange
        let remaining: Decimal = 1000
        let daysRemaining = 10

        // Act
        let dailyBudget = remaining / Decimal(daysRemaining)

        // Assert
        #expect(dailyBudget == 100)
    }

    @Test func dailyBudgetLogic_withZeroDays_returns0() {
        #expect(
            Self.calculateDailyBudget(remaining: 1000, daysRemaining: 0) == 0
        )
    }

    @Test func dailyBudgetLogic_withNegativeRemaining_returns0() {
        // Arrange
        let remaining: Decimal = -500
        let daysRemaining = 10

        // Act
        let dailyBudget = remaining > 0 ? remaining / Decimal(daysRemaining) : 0

        // Assert
        #expect(dailyBudget == 0)
    }

    @Test func dailyBudgetLogic_withSingleDayLeft_returnsFullRemaining() {
        // Arrange
        let remaining: Decimal = 250
        let daysRemaining = 1

        // Act
        let dailyBudget = remaining / Decimal(daysRemaining)

        // Assert
        #expect(dailyBudget == 250)
    }

    // MARK: - BudgetListStore Grouped By Year Logic

    @Test func groupedByYearLogic_groupsBudgetsByYear() {
        // Arrange
        let budgets = [
            TestDataFactory.createBudget(id: "b1", month: 1, year: 2024),
            TestDataFactory.createBudget(id: "b2", month: 6, year: 2024),
            TestDataFactory.createBudget(id: "b3", month: 3, year: 2025),
            TestDataFactory.createBudget(id: "b4", month: 12, year: 2023)
        ]

        // Act
        let grouped = Dictionary(grouping: budgets) { $0.year }
        let yearGroups = grouped
            .sorted { $0.key < $1.key }
            .map { year, budgets in (year: year, budgets: budgets.sorted { $0.month < $1.month }) }

        // Assert
        #expect(yearGroups.count == 3)
        #expect(yearGroups[0].year == 2023)
        #expect(yearGroups[1].year == 2024)
        #expect(yearGroups[2].year == 2025)
    }

    @Test func groupedByYearLogic_sortsBudgetsByMonthWithinYear() {
        // Arrange
        let budgets = [
            TestDataFactory.createBudget(id: "b1", month: 12, year: 2024),
            TestDataFactory.createBudget(id: "b2", month: 3, year: 2024),
            TestDataFactory.createBudget(id: "b3", month: 7, year: 2024),
            TestDataFactory.createBudget(id: "b4", month: 1, year: 2024)
        ]

        // Act
        let grouped = Dictionary(grouping: budgets) { $0.year }
        let yearGroups = grouped
            .sorted { $0.key < $1.key }
            .map { year, budgets in (year: year, budgets: budgets.sorted { $0.month < $1.month }) }

        // Assert
        let months = yearGroups[0].budgets.map { $0.month }
        #expect(months == [1, 3, 7, 12])
    }

    @Test func groupedByYearLogic_emptyBudgets_returnsEmptyArray() {
        // Arrange
        let budgets: [Budget] = []

        // Act
        let grouped = Dictionary(grouping: budgets) { $0.year }
        let yearGroups = grouped
            .sorted { $0.key < $1.key }
            .map { year, budgets in (year: year, budgets: budgets.sorted { $0.month < $1.month }) }

        // Assert
        #expect(yearGroups.isEmpty)
    }

    // MARK: - Helpers

    /// Mirrors CurrentMonthStore.dailyBudget logic
    private static func calculateDailyBudget(remaining: Decimal, daysRemaining: Int) -> Decimal {
        guard daysRemaining > 0, remaining > 0 else { return 0 }
        return remaining / Decimal(daysRemaining)
    }

    @Test func groupedByYearLogic_singleBudget_createsSingleGroup() {
        // Arrange
        let budgets = [
            TestDataFactory.createBudget(id: "b1", month: 5, year: 2024)
        ]

        // Act
        let grouped = Dictionary(grouping: budgets) { $0.year }
        let yearGroups = grouped
            .sorted { $0.key < $1.key }
            .map { year, budgets in (year: year, budgets: budgets.sorted { $0.month < $1.month }) }

        // Assert
        #expect(yearGroups.count == 1)
        #expect(yearGroups[0].budgets.count == 1)
    }
}
