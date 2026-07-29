import Foundation
@testable import Pulpe
import Testing

struct HomeHeroCardTests {
    @Test func estimateComparison_keepsSignedMeaning() {
        let state = HomeHeroCard.PresentationState(
            plannedBalance: 450,
            estimatedBalance: 800
        )

        #expect(state.estimatedBalance == 800)
        #expect(state.variance == 350)
        #expect(state.verdict == .gain)
        #expect(state.tone == .favorable)

        let onPlan = HomeHeroCard.PresentationState(
            plannedBalance: 450,
            estimatedBalance: 450
        )
        #expect(onPlan.variance == 0)
        #expect(onPlan.verdict == .onPlan)
    }

    @Test func deficitAcrossZero_isOverrunAndDeficit() {
        let state = HomeHeroCard.PresentationState(
            plannedBalance: 450,
            estimatedBalance: -3000
        )

        #expect(state.estimatedBalance == -3000)
        #expect(state.variance == -3450)
        #expect(state.verdict == .overrun)
        #expect(state.tone == .deficit)
    }

    @Test func trajectory_usesRealizedStepsAndConnectsRemainingPlan() throws {
        let transactions = [
            try checkedExpense(id: "day-2", amount: 100, day: 2),
            try checkedExpense(id: "day-3", amount: 50, day: 3),
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

    @Test func trajectory_payDayPeriodIncludesOnlyItsCrossMonthTransactions() throws {
        let trajectory = try #require(BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: [],
            transactions: [
                try checkedExpense(id: "before", amount: 25, year: 2026, month: 2, day: 26),
                try checkedExpense(id: "start", amount: 100, year: 2026, month: 2, day: 27),
                try checkedExpense(id: "today", amount: 50, year: 2026, month: 3, day: 1),
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
                try checkedExpense(id: "start", amount: 100, year: 2025, month: 12, day: 27),
                try checkedExpense(id: "end", amount: 50, year: 2026, month: 1, day: 26),
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

    @MainActor
    @Test func chartDomain_containsPlanAboveBelowAndEqualToTrajectory() {
        let above = trajectory(actual: [100, 80], projected: [80, 60], plan: 200)
        let aboveDomain = HomeHeroCard.chartYDomain(for: above)
        #expect(aboveDomain.contains(60))
        #expect(aboveDomain.contains(200))

        let below = trajectory(actual: [100, 80], projected: [80, 60], plan: -100)
        let belowDomain = HomeHeroCard.chartYDomain(for: below)
        #expect(belowDomain.contains(-100))
        #expect(belowDomain.contains(100))

        let flat = trajectory(actual: [50, 50], projected: [50, 50], plan: 50)
        let flatDomain = HomeHeroCard.chartYDomain(for: flat)
        #expect(flatDomain.lowerBound < 50)
        #expect(flatDomain.upperBound > 50)
    }

    @Test func hiddenAmounts_accessibilityDescriptionContainsNoFinancialValue() {
        let state = HomeHeroCard.PresentationState(
            plannedBalance: 450,
            estimatedBalance: -3000
        )

        let description = state.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: true,
            uncheckedCount: 1
        )

        #expect(
            description
                == """
                Juillet. Solde estimé fin de mois, montant masqué. \
                Comparaison au budget masquée. 1 opération à pointer.
                """
        )
        #expect(!description.contains("CHF"))
        #expect(!description.contains("450"))
        #expect(!description.contains("3000"))
    }

    @Test func accessibilityDescription_explainsComparisonInEverydayFrench() {
        let gain = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 800)
        let overrun = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 300)
        let onPlan = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 450)

        #expect(gain.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 2
        ).contains("350.00 CHF de mieux que prévu"))
        #expect(overrun.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 0
        ).contains("150.00 CHF de moins que prévu"))
        #expect(onPlan.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 1
        ).contains("Conforme à ton budget"))
    }

    @Test func loadedDashboardUsesOneFullScreenGradientBackground() throws {
        let sourceFile = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Pulpe/Features/CurrentMonth/CurrentMonthView.swift")
        let source = try String(contentsOf: sourceFile, encoding: .utf8)

        #expect(source.contains(".background { dashboardBackground.ignoresSafeArea() }"))
        #expect(!source.contains(".background(Color.homeBackground)"))
        #expect(source.components(separatedBy: "LinearGradient(").count == 2)
    }

    @Test func chartAnnotationsStayOnOppositeSides() throws {
        let sourceFile = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift")
        let source = try String(contentsOf: sourceFile, encoding: .utf8)

        #expect(source.contains(".annotation(position: .top, alignment: .leading)"))
        #expect(source.contains(".annotation(position: .bottom, alignment: .trailing)"))
    }

    @Test func heroCopyDropsPlanVarianceAndDailyRateKpis() throws {
        let sourceFile = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift")
        let source = try String(contentsOf: sourceFile, encoding: .utf8)

        #expect(!source.contains("\"Écart estimé\""))
        #expect(!source.contains("\"Plan\""))
        #expect(!source.contains("/jour"))
    }

    private func checkedExpense(
        id: String,
        amount: Decimal,
        year: Int = 2026,
        month: Int = 7,
        day: Int
    ) throws -> Transaction {
        let date = try date(year: year, month: month, day: day)
        return Transaction(
            id: id,
            budgetId: "july",
            budgetLineId: nil,
            name: id,
            amount: amount,
            kind: .expense,
            transactionDate: date,
            category: nil,
            checkedAt: date,
            createdAt: date,
            updatedAt: date
        )
    }

    private func trajectory(
        actual: [Decimal],
        projected: [Decimal],
        plan: Decimal
    ) -> BudgetFormulas.BalanceTrajectory {
        BudgetFormulas.BalanceTrajectory(
            tracked: actual.enumerated().map { .init(day: $0.offset, balance: $0.element) },
            remainingPlan: projected.enumerated().map { .init(day: $0.offset + 1, balance: $0.element) },
            plannedBalance: plan,
            today: 1,
            totalDays: 2
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
