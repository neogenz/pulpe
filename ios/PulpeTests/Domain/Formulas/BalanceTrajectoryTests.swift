import Foundation
@testable import Pulpe
import Testing

/// `BudgetFormulas.calculateBalanceTrajectory` — the period arithmetic behind the home
/// chart. What the card then *says* about a trajectory lives in `HomeHeroCardTests`.
///
/// Shares its numeric fixtures with `shared/src/calculators/balance-trajectory.spec.ts`,
/// so a divergence between the two implementations fails an assertion here.
struct BalanceTrajectoryTests {
    // 5 000 in, 2 500 out: the plan lands on 2 500, and every case below is read against it.
    private let lines = [
        TestDataFactory.createBudgetLine(id: "salary", amount: 5_000, kind: .income),
        TestDataFactory.createBudgetLine(id: "rent", amount: 2_000, kind: .expense),
        TestDataFactory.createBudgetLine(id: "food", amount: 500, kind: .expense),
    ]

    @Test func landing_opensOnThePlanAndArrivesOnTheEstimate() throws {
        // The two ends of the line are the two numbers the card already prints: the origin
        // is `plannedRemaining`, the arrival is the hero. Both are asserted against the very
        // formulas the dashboard calls, so the plot cannot drift from the text around it.
        let transactions = [try transaction(id: "groceries", amount: 800, day: 5)]
        let trajectory = try #require(makeTrajectory(transactions: transactions))

        let planned = BudgetFormulas.calculateAllMetrics(budgetLines: lines).remaining
        let estimated = BudgetFormulas
            .calculateAllMetrics(budgetLines: lines, transactions: transactions)
            .remaining

        #expect(trajectory.plannedBalance == planned)
        #expect(trajectory.estimatedBalance == estimated)
        #expect(trajectory.drift == estimated - planned)
        #expect(trajectory.landing.map(\.day) == Array(0 ... 15))
    }

    @Test func landing_holdsItsPlanWhileNothingHasBeenSpent() throws {
        let trajectory = try #require(makeTrajectory(transactions: []))

        #expect(Set(trajectory.landing.map(\.balance)) == [2_500])
        #expect(trajectory.drift == 0)
        #expect(trajectory.driftDate == nil)
    }

    @Test func landing_doesNotMoveWhenAnOperationIsOnlyPointed() throws {
        // The whole reason the chart changed: the old curve dropped by a line's full amount
        // the day it was ticked, so it measured the pointing ritual instead of the month.
        // Pointing confirms a forecast — the landing forecast has to stay exactly put.
        let pointed = [
            TestDataFactory.createBudgetLine(id: "salary", amount: 5_000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "rent", amount: 2_000, kind: .expense, isChecked: true),
            TestDataFactory.createBudgetLine(id: "food", amount: 500, kind: .expense),
        ]
        let trajectory = try #require(makeTrajectory(
            budgetLines: pointed,
            transactions: [try transaction(id: "rent-paid", amount: 2_000, budgetLineId: "rent", day: 3)]
        ))

        #expect(Set(trajectory.landing.map(\.balance)) == [2_500])
        #expect(trajectory.driftDate == nil)
    }

    @Test func landing_dropsOnTheDayAnEnvelopeIsOverrun() throws {
        // 800 spent against a 500 envelope: 300 has to come from somewhere, so the month
        // lands 300 lower — dated to the day the money actually left.
        let trajectory = try #require(makeTrajectory(
            transactions: [try transaction(id: "groceries", amount: 800, budgetLineId: "food", day: 5)]
        ))

        #expect(trajectory.landing.prefix(5).allSatisfy { $0.balance == 2_500 })
        #expect(trajectory.landing.dropFirst(5).allSatisfy { $0.balance == 2_200 })
        #expect(trajectory.driftDate == (try day(year: 2026, month: 7, day: 5)))
        #expect(trajectory.drift == -300)
    }

    @Test func landing_risesWhenIncomeLandsBeyondItsPlan() throws {
        // The favourable case, and the one that proves the line is not a spending gauge: a
        // bonus moves where the month lands just as surely as an overrun does.
        let trajectory = try #require(makeTrajectory(
            transactions: [try transaction(id: "bonus", amount: 400, kind: .income, day: 9)]
        ))

        #expect(trajectory.drift == 400)
        #expect(trajectory.driftDate == (try day(year: 2026, month: 7, day: 9)))
    }

    @Test func landing_countsAMisdatedTransactionOnTheDayTheHeroDoes() throws {
        // A transaction dated before the period is still money the hero counts. The last
        // reading is the hero's, so it carries it too — otherwise the line would stop short
        // of the figure printed directly above it.
        let transactions = [try transaction(id: "early", amount: 300, month: 6, day: 28)]
        let trajectory = try #require(makeTrajectory(transactions: transactions))

        #expect(trajectory.plannedBalance == 2_500)
        #expect(trajectory.estimatedBalance == 2_200)
        #expect(trajectory.landing.dropLast().allSatisfy { $0.balance == 2_500 })
    }

    @Test func plannedOutflows_sumsTheOutflowLinesOfThePeriodOnly() throws {
        let trajectory = try #require(makeTrajectory(
            budgetLines: lines + [
                TestDataFactory.createBudgetLine(
                    id: "report",
                    amount: 900,
                    kind: .expense,
                    isRollover: true
                ),
            ],
            transactions: []
        ))

        #expect(trajectory.plannedOutflows == 2_500)
    }

    @Test func trajectory_payDayPeriodIncludesOnlyItsCrossMonthTransactions() throws {
        let trajectory = try #require(BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: lines,
            transactions: [
                try transaction(id: "before", amount: 25, year: 2026, month: 2, day: 26),
                try transaction(id: "start", amount: 100, year: 2026, month: 2, day: 27),
                try transaction(id: "today", amount: 50, year: 2026, month: 3, day: 1),
            ],
            budget: TestDataFactory.createBudget(month: 3, year: 2026),
            payDayOfMonth: 27,
            referenceDate: try date(year: 2026, month: 3, day: 1)
        ))

        #expect(trajectory.today == 3)
        #expect(trajectory.totalDays == 28)
        // Day 0 knows nothing; day 1 covers the 27th, so the 100 spent on it is already in.
        // The last reading is the hero's, so it also holds the 25 dated before the period.
        #expect(trajectory.landing.map(\.balance) == [2_500, 2_400, 2_400, 2_325])
    }

    @Test func trajectory_firstHalfPayDayUsesTheFollowingCalendarMonth() throws {
        let trajectory = try #require(BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: lines,
            transactions: [],
            budget: TestDataFactory.createBudget(month: 3, year: 2026),
            payDayOfMonth: 5,
            referenceDate: try date(year: 2026, month: 4, day: 2)
        ))

        #expect(trajectory.today == 29)
        #expect(trajectory.totalDays == 31)
    }

    @Test func trajectory_yearBoundaryIncludesBothPeriodEndsExactlyOnce() throws {
        let trajectory = try #require(BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: lines,
            transactions: [
                try transaction(id: "start", amount: 100, year: 2025, month: 12, day: 27),
                try transaction(id: "end", amount: 50, year: 2026, month: 1, day: 26),
            ],
            budget: TestDataFactory.createBudget(month: 1, year: 2026),
            payDayOfMonth: 27,
            referenceDate: try date(year: 2026, month: 1, day: 26)
        ))

        #expect(trajectory.today == 31)
        #expect(trajectory.totalDays == 31)
        #expect(trajectory.plannedBalance == 2_500)
        #expect(trajectory.estimatedBalance == 2_350)
    }

    @Test func trajectory_isAbsentOutsideItsOwnPeriod() throws {
        #expect(BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: lines,
            transactions: [],
            budget: TestDataFactory.createBudget(month: 7, year: 2026),
            payDayOfMonth: nil,
            referenceDate: try date(year: 2026, month: 9, day: 1)
        ) == nil)
    }

    // MARK: - Real series

    @Test func real_opensOnWhatThePeriodHadAndHoldsWhileNothingIsPointed() throws {
        let trajectory = try #require(makeTrajectory(transactions: []))

        #expect(trajectory.plannedAvailable == 5_000)
        #expect(Set(trajectory.real.map(\.balance)) == [5_000])
        #expect(trajectory.real.map(\.day) == Array(0 ... 15))
    }

    @Test func real_dropsOnTheDayALineIsPointed_andIgnoresAForecastNotYetConfirmed() throws {
        let rent = TestDataFactory.createBudgetLine(
            id: "rent", amount: 2_000, kind: .expense, checkedAt: try date(year: 2026, month: 7, day: 5)
        )
        let food = TestDataFactory.createBudgetLine(id: "food", amount: 500, kind: .expense)
        let trajectory = try #require(makeTrajectory(budgetLines: [lines[0], rent, food], transactions: []))

        let byDay = Dictionary(uniqueKeysWithValues: trajectory.real.map { ($0.day, $0.balance) })
        // Index d reads through day d (day 1 is pay day): the 5th's pointing shows from index 5.
        #expect(byDay[4] == 5_000)
        #expect(byDay[5] == 3_000)
        #expect(byDay[15] == 3_000)
    }

    @Test func real_dropsOnAPointedTransaction_andNotOnAnUncheckedOne() throws {
        let pointed = try transaction(id: "groceries", amount: 120, day: 8)
        var pending = try transaction(id: "bar", amount: 60, day: 9)
        pending = Transaction(
            id: pending.id, budgetId: pending.budgetId, budgetLineId: nil, name: pending.name,
            amount: pending.amount, kind: pending.kind, transactionDate: pending.transactionDate,
            category: nil, checkedAt: nil, createdAt: pending.createdAt, updatedAt: pending.updatedAt
        )
        let trajectory = try #require(makeTrajectory(transactions: [pointed, pending]))

        let byDay = Dictionary(uniqueKeysWithValues: trajectory.real.map { ($0.day, $0.balance) })
        #expect(byDay[7] == 5_000)
        #expect(byDay[8] == 4_880)
        #expect(byDay[15] == 4_880)
    }

    @Test func real_lastReadingIsTheOpeningMinusEverythingRealized() throws {
        let rent = TestDataFactory.createBudgetLine(
            id: "rent", amount: 2_000, kind: .expense, checkedAt: try date(year: 2026, month: 7, day: 2)
        )
        let transactions = [try transaction(id: "groceries", amount: 800, day: 5)]
        let budgetLines = [lines[0], rent, lines[2]]
        let trajectory = try #require(makeTrajectory(budgetLines: budgetLines, transactions: transactions))

        let realized = BudgetFormulas.calculateRealizedExpenses(
            budgetLines: budgetLines, transactions: transactions
        )
        #expect(trajectory.real.last?.balance == 5_000 - realized)
    }

    // MARK: - Helpers

    private func makeTrajectory(
        budgetLines: [BudgetLine]? = nil,
        transactions: [Transaction]
    ) -> BudgetFormulas.BalanceTrajectory? {
        guard let referenceDate = Calendar.current.date(from: DateComponents(
            year: 2026,
            month: 7,
            day: 15,
            hour: 12
        )) else { return nil }
        return BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: budgetLines ?? lines,
            transactions: transactions,
            budget: TestDataFactory.createBudget(month: 7, year: 2026),
            payDayOfMonth: nil,
            referenceDate: referenceDate
        )
    }

    private func transaction(
        id: String,
        amount: Decimal,
        kind: TransactionKind = .expense,
        budgetLineId: String? = nil,
        year: Int = 2026,
        month: Int = 7,
        day: Int
    ) throws -> Transaction {
        let date = try date(year: year, month: month, day: day)
        return Transaction(
            id: id,
            budgetId: "july",
            budgetLineId: budgetLineId,
            name: id,
            amount: amount,
            kind: kind,
            transactionDate: date,
            category: nil,
            checkedAt: date,
            createdAt: date,
            updatedAt: date
        )
    }

    private func date(year: Int, month: Int, day: Int) throws -> Date {
        try #require(Calendar.current.date(from: DateComponents(
            year: year,
            month: month,
            day: day,
            hour: 12
        )))
    }

    /// A drift date names a day, not a moment: the formula counts from the period's own
    /// start of day, and the copy only ever prints "5 juillet".
    private func day(year: Int, month: Int, day: Int) throws -> Date {
        Calendar.current.startOfDay(for: try date(year: year, month: month, day: day))
    }
}
