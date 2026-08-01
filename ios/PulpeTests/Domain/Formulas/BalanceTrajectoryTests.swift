import Foundation
@testable import Pulpe
import Testing

/// `BudgetFormulas.calculateBalanceTrajectory` — the period arithmetic behind the home
/// chart. What the card then *says* about a trajectory lives in `HomeHeroCardTests`.
struct BalanceTrajectoryTests {
    @Test func trajectory_usesRealizedStepsAndConnectsRemainingPlan() throws {
        let transactions = [
            try checkedTransaction(id: "day-2", amount: 100, day: 2),
            try checkedTransaction(id: "day-3", amount: 50, day: 3),
        ]
        let metrics = BudgetFormulas.Metrics(
            totalIncome: 1000,
            totalExpenses: 700,
            totalSavings: 0,
            available: 1000,
            endingBalance: 300,
            remaining: 300,
            rollover: 0
        )
        let referenceDate = try #require(Calendar.current.date(from: DateComponents(
            year: 2026,
            month: 7,
            day: 3,
            hour: 12
        )))

        let trajectory = try #require(BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: [],
            transactions: transactions,
            metrics: metrics,
            plannedBalance: 250,
            budget: TestDataFactory.createBudget(month: 7, year: 2026),
            payDayOfMonth: nil,
            referenceDate: referenceDate
        ))

        #expect(trajectory.tracked.map(\.balance) == [1000, 1000, 900, 850])
        #expect(trajectory.remainingPlan == [
            .init(day: 3, balance: 850),
            .init(day: 31, balance: 300),
        ])
        #expect(trajectory.plannedBalance == 250)
        #expect(trajectory.today == 3)
        #expect(trajectory.totalDays == 31)
    }

    @Test func trajectory_pointingAnIncomeLeavesTheCurveFlat() throws {
        // The curve burns down from `available`, which already holds the month's whole
        // planned income — so pointing a salary confirms money the estimate had assumed
        // rather than adding any, and the line cannot move. The home copy is written
        // around this: it says the balance has not moved, never that nothing was pointed.
        let trajectory = try #require(BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: [],
            transactions: [
                try checkedTransaction(id: "salary", amount: 5_000, kind: .income, day: 2),
            ],
            metrics: metrics(available: 5_000, remaining: 1_500),
            plannedBalance: 1_500,
            budget: TestDataFactory.createBudget(month: 7, year: 2026),
            payDayOfMonth: nil,
            referenceDate: try date(year: 2026, month: 7, day: 3)
        ))

        #expect(Set(trajectory.tracked.map(\.balance)) == [5_000])
        #expect(trajectory.hasNothingTracked)
    }

    @Test func trajectory_payDayPeriodIncludesOnlyItsCrossMonthTransactions() throws {
        let trajectory = try #require(BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: [],
            transactions: [
                try checkedTransaction(id: "before", amount: 25, year: 2026, month: 2, day: 26),
                try checkedTransaction(id: "start", amount: 100, year: 2026, month: 2, day: 27),
                try checkedTransaction(id: "today", amount: 50, year: 2026, month: 3, day: 1),
            ],
            metrics: metrics(available: 1_000, remaining: 300),
            plannedBalance: 250,
            budget: TestDataFactory.createBudget(month: 3, year: 2026),
            payDayOfMonth: 27,
            referenceDate: try date(year: 2026, month: 3, day: 1)
        ))

        #expect(trajectory.today == 3)
        #expect(trajectory.totalDays == 28)
        #expect(trajectory.tracked.map(\.balance) == [1_000, 900, 900, 850])
        #expect(trajectory.remainingPlan == [
            .init(day: 3, balance: 850),
            .init(day: 28, balance: 300),
        ])
    }

    @Test func trajectory_payDayPeriodIgnoresBudgetLinesCheckedBeforeItsStart() throws {
        let trajectory = try #require(BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: [
                try checkedExpenseLine(
                    id: "before",
                    amount: 25,
                    year: 2026,
                    month: 2,
                    day: 26
                ),
                try checkedExpenseLine(
                    id: "start",
                    amount: 100,
                    year: 2026,
                    month: 2,
                    day: 27
                ),
            ],
            transactions: [
                try checkedTransaction(
                    id: "allocated",
                    amount: 150,
                    budgetLineId: "start",
                    year: 2026,
                    month: 3,
                    day: 1
                ),
            ],
            metrics: metrics(available: 1_000, remaining: 300),
            plannedBalance: 250,
            budget: TestDataFactory.createBudget(month: 3, year: 2026),
            payDayOfMonth: 27,
            referenceDate: try date(year: 2026, month: 3, day: 1)
        ))

        #expect(trajectory.tracked.map(\.balance) == [1_000, 900, 900, 850])
    }

    @Test func trajectory_firstHalfPayDayUsesTheFollowingCalendarMonth() throws {
        let trajectory = try #require(BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: [],
            transactions: [],
            metrics: metrics(available: 1_000, remaining: 300),
            plannedBalance: 250,
            budget: TestDataFactory.createBudget(month: 3, year: 2026),
            payDayOfMonth: 5,
            referenceDate: try date(year: 2026, month: 4, day: 2)
        ))

        #expect(trajectory.today == 29)
        #expect(trajectory.totalDays == 31)
    }

    @Test func trajectory_yearBoundaryIncludesBothPeriodEndsExactlyOnce() throws {
        let trajectory = try #require(BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: [],
            transactions: [
                try checkedTransaction(id: "start", amount: 100, year: 2025, month: 12, day: 27),
                try checkedTransaction(id: "end", amount: 50, year: 2026, month: 1, day: 26),
            ],
            metrics: metrics(available: 1_000, remaining: 300),
            plannedBalance: 250,
            budget: TestDataFactory.createBudget(month: 1, year: 2026),
            payDayOfMonth: 27,
            referenceDate: try date(year: 2026, month: 1, day: 26)
        ))

        #expect(trajectory.today == 31)
        #expect(trajectory.totalDays == 31)
        #expect(trajectory.tracked.first?.balance == 1_000)
        #expect(trajectory.tracked.last?.balance == 850)
        #expect(trajectory.remainingPlan.isEmpty)
    }

    private func checkedTransaction(
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

    private func checkedExpenseLine(
        id: String,
        amount: Decimal,
        year: Int,
        month: Int,
        day: Int
    ) throws -> BudgetLine {
        let checkedAt = try date(year: year, month: month, day: day)
        return BudgetLine(
            id: id,
            budgetId: "july",
            templateLineId: nil,
            savingsGoalId: nil,
            name: id,
            amount: amount,
            kind: .expense,
            recurrence: .fixed,
            isManuallyAdjusted: false,
            checkedAt: checkedAt,
            createdAt: checkedAt,
            updatedAt: checkedAt
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

    private func metrics(
        available: Decimal,
        remaining: Decimal
    ) -> BudgetFormulas.Metrics {
        .init(
            totalIncome: available,
            totalExpenses: available - remaining,
            totalSavings: 0,
            available: available,
            endingBalance: remaining,
            remaining: remaining,
            rollover: 0
        )
    }
}
