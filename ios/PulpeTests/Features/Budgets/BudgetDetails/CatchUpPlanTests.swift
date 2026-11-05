import Foundation
@testable import Pulpe
import Testing

@Suite("CatchUpPlan")
struct CatchUpPlanTests {
    /// Courses 600 / 664.20 spent (+64.20), Sorties 100 / 138 spent (+38), Loisirs 150 and
    /// Transport 88 untouched, an épargne and a report with margin that must not be offered.
    private static let ledger: MonthLedger = {
        let lines = [
            TestDataFactory.createBudgetLine(id: "salary", amount: 5000, kind: .income),
            TestDataFactory.createBudgetLine(id: "courses", name: "Courses", amount: 600),
            TestDataFactory.createBudgetLine(id: "sorties", name: "Sorties", amount: 100),
            TestDataFactory.createBudgetLine(id: "loisirs", name: "Loisirs", amount: 150),
            TestDataFactory.createBudgetLine(id: "transport", name: "Transport", amount: 88),
            TestDataFactory.createBudgetLine(id: "pillar", amount: 500, kind: .saving),
            TestDataFactory.createBudgetLine(id: "rollover", amount: 900, isRollover: true)
        ]
        let txs = [
            TestDataFactory.createTransaction(id: "t1", budgetLineId: "courses", amount: 664.20),
            TestDataFactory.createTransaction(id: "t2", budgetLineId: "sorties", amount: 138)
        ]
        return MonthLedger(lines: lines, transactions: txs, rollover: 0)
    }()

    @Test func wholeMonth_sumsOverrunsAndOffersOnlyExpensesWithMargin() {
        let plan = CatchUpPlan.make(ledger: Self.ledger, focusLineId: nil, userCurrency: .chf)
        #expect(plan.total == 102.20)
        #expect(plan.overruns.map(\.name) == ["Courses", "Sorties"])
        #expect(plan.choices.map(\.id) == ["loisirs", "transport"])
        #expect(plan.choices.map(\.newAmount) == [47.80, 0])
        #expect(plan.choices.map(\.coversAll) == [true, false])
        #expect(plan.defaultChoiceId == "loisirs")
    }

    @Test func takingItBack_raisesTheDisponibleByWhatTheMarginCovers() throws {
        let plan = CatchUpPlan.make(ledger: Self.ledger, focusLineId: nil, userCurrency: .chf)
        let loisirs = try #require(plan.choices.first)
        let transport = try #require(plan.choices.last)
        #expect(CatchUpPlan.impact(of: loisirs, in: Self.ledger).delta == 102.20)
        #expect(CatchUpPlan.impact(of: transport, in: Self.ledger).delta == 88)
    }

    @Test func fromOnePrevision_takesBackOnlyItsOverrun() {
        let plan = CatchUpPlan.make(ledger: Self.ledger, focusLineId: "courses", userCurrency: .chf)
        #expect(plan.total == 64.20)
        #expect(plan.choices.map(\.newAmount) == [85.80, 23.80])
        #expect(plan.choices.map(\.coversAll) == [true, true])
    }

    @Test func nothingOver_offersNothing() {
        let plan = CatchUpPlan.make(ledger: Self.ledger, focusLineId: "loisirs", userCurrency: .chf)
        #expect(plan.overruns.isEmpty)
        #expect(plan.choices.isEmpty)
        #expect(plan.defaultChoiceId == nil)
    }
}
