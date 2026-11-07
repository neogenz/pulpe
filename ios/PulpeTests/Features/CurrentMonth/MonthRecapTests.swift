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
        expenses: Decimal,
        savings: Decimal? = nil,
        rollover: Decimal? = nil
    ) -> BudgetSparse {
        TestDataFactory.createBudgetSparse(
            id: id,
            month: month,
            year: year,
            totalExpenses: expenses,
            totalSavings: savings,
            totalIncome: income,
            rollover: rollover
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

    @Test func closedMonth_splitsSavingsFromSpending_andKeepsItsOwnReport() throws {
        let current = TestDataFactory.createBudget(id: "june", month: 6, year: 2025)
        let budgets = [
            Self.sparse(id: "may", month: 5, year: 2025, income: 5_000, expenses: 4_700, savings: 1_088, rollover: 120),
        ]

        let recap = try #require(MonthRecap(closingBefore: current, among: budgets, metrics: Self.metrics))

        #expect(recap.expenses == 4_700)
        #expect(recap.savings == 1_088)
        #expect(recap.spending == 3_612)
        #expect(recap.previousRollover == 120)
        #expect(recap.endingBalance == 300)
    }

    @Test func closedMonth_withoutSavingsField_countsEveryOutflowAsSpending() throws {
        let current = TestDataFactory.createBudget(id: "june", month: 6, year: 2025)
        let budgets = [Self.sparse(id: "may", month: 5, year: 2025, income: 5_000, expenses: 4_700)]

        let recap = try #require(MonthRecap(closingBefore: current, among: budgets, metrics: Self.metrics))

        #expect(recap.savings == 0)
        #expect(recap.spending == 4_700)
        #expect(recap.previousRollover == 0)
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

/// « Ce qui a compté »: savings, overruns, pointing, read from the closed month's details.
@Suite("Month recap findings")
struct MonthRecapFindingsTests {
    @Test func everythingPaidAndPointed_reportsSavingsOverrunsAndPointing() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "japan", name: "Japon", amount: 500, kind: .saving, isChecked: true),
            TestDataFactory.createBudgetLine(id: "groceries", name: "Courses", amount: 400, isChecked: true),
            TestDataFactory.createBudgetLine(id: "outings", name: "Sorties", amount: 100, isChecked: true),
            TestDataFactory.createBudgetLine(
                id: "rollover", name: "Report", amount: 10, kind: .income, isRollover: true
            ),
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "a", budgetLineId: "groceries", amount: 450, isChecked: true),
            TestDataFactory.createTransaction(id: "b", budgetLineId: "outings", amount: 110, isChecked: true),
        ]

        let findings = MonthRecapFindings.make(lines: lines, transactions: transactions, month: 10, currency: .chf)

        #expect(findings.map(\.title) == [
            "Épargne versée en entier", "2 prévisions dépassées", "Tout est pointé",
        ])
        #expect(findings[0].subtitle == "Japon 500.00")
        #expect(findings[1].subtitle == "Courses et Sorties")
        #expect(findings[1].overrun == 60)
        #expect(findings[2].subtitle == "2 mouvements pointés en octobre")
    }

    @Test func unpaidSavingsAndUnpointedItems_sayWhatIsLeft() {
        let lines = [TestDataFactory.createBudgetLine(id: "pillar", name: "3e pilier", amount: 588, kind: .saving)]
        let transactions = [TestDataFactory.createTransaction(id: "a", amount: 20, isChecked: true)]

        let findings = MonthRecapFindings.make(lines: lines, transactions: transactions, month: 9, currency: .chf)

        #expect(findings.map(\.title) == ["Épargne versée en partie", "1 encore à pointer"])
        #expect(findings[0].subtitle == "Pas versé : 3e pilier")
        #expect(findings[1].subtitle == "1 mouvement pointé en septembre")
    }

    @Test func nothingPointed_saysSoInsteadOfCountingZero() {
        let transactions = [TestDataFactory.createTransaction(id: "a", amount: 20)]

        let findings = MonthRecapFindings.make(lines: [], transactions: transactions, month: 10, currency: .chf)

        #expect(findings.map(\.subtitle) == ["Rien de pointé en octobre"])
    }

    @Test func emptyMonth_hasNothingToSay() {
        #expect(MonthRecapFindings.make(lines: [], transactions: [], month: 9, currency: .chf).isEmpty)
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
