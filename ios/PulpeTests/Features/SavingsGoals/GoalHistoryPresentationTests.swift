import Foundation
@testable import Pulpe
import Testing

@Suite("GoalHistoryPresentation Tests")
struct GoalHistoryPresentationTests {
    /// Départ 300 in August, 300 pointed in September, 200 pointed and 200 drawn in
    /// October, November still ahead: 300 + 500 − 200 = 600 mis de côté.
    private func makeHistory(withdrawals: [SavingsGoalWithdrawal]) -> GoalHistoryPresentation {
        GoalHistoryPresentation(
            progress: makeProgress(months: [
                makeMonth(month: 8, state: .past, confirmed: 0, withdrawn: 0, cumulative: 300),
                makeMonth(month: 9, state: .past, confirmed: 300, withdrawn: 0, cumulative: 600),
                makeMonth(month: 10, state: .current, confirmed: 200, withdrawn: 200, cumulative: 600),
                makeMonth(month: 11, state: .future, confirmed: 0, withdrawn: 0, cumulative: 600),
            ]),
            withdrawals: withdrawals,
            payDayOfMonth: nil
        )
    }

    @Test("the account adds up to the saved figure")
    func account_addsUpToSaved() {
        let history = makeHistory(withdrawals: [makeWithdrawal(id: "tx-oct", month: 10)])

        #expect(history.initialAmount == 300)
        #expect(history.contributed == 500)
        #expect(history.withdrawn == 200)
        #expect(history.saved == 600)
        #expect(history.pointedMonthCount == 2)
        #expect(history.summary(currency: .chf).contains("2 mois pointés"))
        #expect(history.summary(currency: .chf).contains("1 retrait"))
    }

    @Test("one group per month that moved, newest first, the départ on the oldest")
    func months_onlyThoseThatMoved_newestFirst() throws {
        let history = makeHistory(withdrawals: [makeWithdrawal(id: "tx-oct", month: 10)])

        #expect(history.months.map(\.period.month) == [10, 9, 8])
        let october = try #require(history.months.first)
        #expect(october.contribution?.amount == 200)
        #expect(october.withdrawals.map(\.transactionId) == ["tx-oct"])
        #expect(october.endBalance == 600)
        let august = try #require(history.months.last)
        #expect(august.initialAmount == 300)
        #expect(august.contribution == nil)
    }

    @Test("the gauge reads the share of the month's plan that was pointed")
    func contribution_fractionOfPlan() throws {
        let history = makeHistory(withdrawals: [])

        let october = try #require(history.months.first { $0.period.month == 10 }?.contribution)
        let september = try #require(history.months.first { $0.period.month == 9 }?.contribution)
        #expect(abs(october.fraction - 2.0 / 3.0) < 0.001)
        #expect(september.fraction == 1)
    }

    @Test("a withdrawal outside the plan window still gets its month, with no balance")
    func withdrawal_outsideTimeline_keepsItsGroup() throws {
        let history = makeHistory(withdrawals: [makeWithdrawal(id: "tx-may", month: 5)])

        let may = try #require(history.months.last)
        #expect(may.period.month == 5)
        #expect(may.endBalance == nil)
        #expect(may.withdrawals.map(\.transactionId) == ["tx-may"])
    }

    private func makeMonth(
        month: Int,
        state: SavingsPlanMonthState,
        confirmed: Decimal,
        withdrawn: Decimal,
        cumulative: Decimal
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: 2026,
            state: state,
            isLocked: state == .past,
            hasBudget: true,
            plannedAmount: 300,
            confirmedAmount: confirmed,
            withdrawnAmount: withdrawn,
            plannedCumulative: 300 * Decimal(month - 7),
            confirmedCumulative: cumulative,
            lines: []
        )
    }

    private func makeProgress(months: [SavingsGoalPlanMonth]) -> SavingsGoalProgress {
        SavingsGoalProgress(
            goalId: "g1",
            status: .active,
            targetAmount: 3_000,
            targetDate: "2027-06-01",
            plannedCumulative: 1_200,
            confirmed: 600,
            initialAmount: 300,
            achievementPercent: 20,
            monthsElapsed: 3,
            monthsRemaining: 8,
            isOverdue: false,
            pace: 300,
            confirmedPace: 250,
            required: 300,
            projected: 3_000,
            paceStatus: .onTrack,
            suggestCompletion: false,
            linkedLineCount: 4,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: months
        )
    }

    private func makeWithdrawal(id: String, month: Int) -> SavingsGoalWithdrawal {
        let date = Calendar.current.date(from: DateComponents(year: 2026, month: month, day: 14)) ?? .now
        return SavingsGoalWithdrawal(
            transactionId: id,
            budgetId: "budget-\(month)",
            name: "Acompte agence",
            transactionDate: date,
            amount: 200
        )
    }
}
