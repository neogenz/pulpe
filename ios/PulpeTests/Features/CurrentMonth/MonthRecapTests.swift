import Foundation
@testable import Pulpe
import Testing

/// Same rule as the webapp's `previousMonthRecap` (PUL-111): the two sides must name the
/// same closed month with the same figures.
@Suite("Month recap")
struct MonthRecapTests {
    private static let metrics = BudgetFormulas.Metrics(
        totalIncome: 5_000,
        totalExpenses: 1_200,
        totalSavings: 0,
        available: 5_300,
        endingBalance: 3_800,
        remaining: 4_100,
        rollover: 300
    )

    private static func sparse(
        id: String,
        month: Int,
        year: Int,
        income: Decimal,
        expenses: Decimal
    ) -> BudgetSparse {
        TestDataFactory.createBudgetSparse(
            id: id,
            month: month,
            year: year,
            totalExpenses: expenses,
            totalIncome: income
        )
    }

    @Test func closedMonth_found_reportsResultAndWhereTheNewMonthStarts() throws {
        let current = TestDataFactory.createBudget(id: "june", month: 6, year: 2025)
        let budgets = [
            Self.sparse(id: "may", month: 5, year: 2025, income: 5_000, expenses: 4_700),
            Self.sparse(id: "june", month: 6, year: 2025, income: 5_000, expenses: 1_200),
        ]

        let recap = try #require(MonthRecap(closingBefore: current, among: budgets, metrics: Self.metrics))

        #expect(recap.budgetId == "may")
        #expect(recap.month == 5)
        #expect(recap.year == 2025)
        #expect(recap.openedMonth == 6)
        #expect(recap.income == 5_000)
        #expect(recap.expenses == 4_700)
        #expect(recap.endingBalance == 300)
        #expect(recap.outcome == .saved)
        #expect(recap.carriedOver == 300)
        #expect(recap.startingAvailable == 5_300)
        #expect(recap.key == "2025-05")
    }

    @Test func january_closesDecemberOfThePreviousYear() throws {
        let current = TestDataFactory.createBudget(id: "jan", month: 1, year: 2025)
        let budgets = [Self.sparse(id: "dec", month: 12, year: 2024, income: 100, expenses: 50)]

        let recap = try #require(MonthRecap(closingBefore: current, among: budgets, metrics: Self.metrics))

        #expect(recap.budgetId == "dec")
        #expect(recap.key == "2024-12")
    }

    @Test func firstMonth_noPreviousBudget_hasNothingToRecap() {
        let current = TestDataFactory.createBudget(id: "june", month: 6, year: 2025)
        let budgets = [Self.sparse(id: "june", month: 6, year: 2025, income: 5_000, expenses: 1_200)]

        #expect(MonthRecap(closingBefore: current, among: budgets, metrics: Self.metrics) == nil)
    }

    @Test(arguments: [
        (Decimal(4_900), MonthRecap.Outcome.overspent),
        (Decimal(string: "4799.6") ?? 0, MonthRecap.Outcome.balanced),
        (Decimal(string: "4800.4") ?? 0, MonthRecap.Outcome.balanced),
        (Decimal(string: "4799.5") ?? 0, MonthRecap.Outcome.saved),
        (Decimal(string: "4800.5") ?? 0, MonthRecap.Outcome.overspent),
    ])
    func outcome_halfAFrancEitherWay_matchesTheWebapp(expenses: Decimal, expected: MonthRecap.Outcome) throws {
        let current = TestDataFactory.createBudget(id: "june", month: 6, year: 2025)
        let budgets = [Self.sparse(id: "may", month: 5, year: 2025, income: 4_800, expenses: expenses)]

        let recap = try #require(MonthRecap(closingBefore: current, among: budgets, metrics: Self.metrics))

        #expect(recap.outcome == expected)
    }
}

@Suite("Month recap flags", .serialized)
struct MonthRecapFlagsStoreTests {
    @Test func dismissedMonth_persistsUntilReset() throws {
        let suiteName = "MonthRecapFlagsStoreTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let sut = MonthRecapFlagsStore(defaults: defaults)

        #expect(sut.lastSeenMonthRecap == nil)

        sut.setLastSeenMonthRecap("2026-09")
        #expect(MonthRecapFlagsStore(defaults: defaults).lastSeenMonthRecap == "2026-09")

        sut.reset()
        #expect(sut.lastSeenMonthRecap == nil)
    }
}
