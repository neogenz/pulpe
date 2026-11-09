import Foundation
@testable import Pulpe
import Testing

@Suite("CatchUpPlan")
struct CatchUpPlanTests {
    /// Courses 600 / 664.20 spent (+64.20), Sorties 100 / 138 spent (+38), Loisirs 150 and
    /// Transport 88 untouched, Cadeaux 100 / 60 spent, a pointée Loyer (already paid), an épargne
    /// and a report with margin that must not be offered.
    private static let ledger: MonthLedger = {
        let lines = [
            TestDataFactory.createBudgetLine(id: "salary", amount: 5000, kind: .income),
            TestDataFactory.createBudgetLine(id: "courses", name: "Courses", amount: 600),
            TestDataFactory.createBudgetLine(id: "sorties", name: "Sorties", amount: 100),
            TestDataFactory.createBudgetLine(id: "loisirs", name: "Loisirs", amount: 150),
            TestDataFactory.createBudgetLine(id: "transport", name: "Transport", amount: 88),
            TestDataFactory.createBudgetLine(id: "gifts", name: "Cadeaux", amount: 100),
            TestDataFactory.createBudgetLine(id: "rent", name: "Loyer", amount: 1200, isChecked: true),
            TestDataFactory.createBudgetLine(id: "pillar", amount: 500, kind: .saving),
            TestDataFactory.createBudgetLine(id: "rollover", amount: 900, isRollover: true)
        ]
        let txs = [
            TestDataFactory.createTransaction(id: "t1", budgetLineId: "courses", amount: 664.20),
            TestDataFactory.createTransaction(id: "t2", budgetLineId: "sorties", amount: 138),
            TestDataFactory.createTransaction(id: "t3", budgetLineId: "gifts", amount: 60)
        ]
        return MonthLedger(lines: lines, transactions: txs, rollover: 0)
    }()

    @Test func wholeMonth_sumsOverrunsAndOffersOnlyExpensesWithMargin() {
        let plan = CatchUpPlan.make(ledger: Self.ledger, focusLineId: nil, userCurrency: .chf)
        #expect(plan.total == 102.20)
        #expect(plan.overruns.map(\.name) == ["Courses", "Sorties"])
        #expect(plan.choices.map(\.id) == ["loisirs", "gifts"])
        #expect(plan.choices.map(\.newAmount) == [47.80, 60])
        #expect(plan.choices.map(\.coversAll) == [true, false])
        #expect(plan.defaultChoiceId == "loisirs")
    }

    @Test func takingItBack_raisesTheDisponibleByWhatTheMarginCovers() throws {
        let plan = CatchUpPlan.make(ledger: Self.ledger, focusLineId: nil, userCurrency: .chf)
        let loisirs = try #require(plan.choices.first)
        let gifts = try #require(plan.choices.last)
        #expect(plan.impact(of: loisirs, in: Self.ledger).delta == 102.20)
        #expect(plan.impact(of: gifts, in: Self.ledger).delta == 40)
    }

    /// The share taken back moves onto the prévisions that overran, in order: once saved, what
    /// was taken back no longer overruns, so the sheet cannot offer to take it back twice.
    @Test func takingItBack_raisesTheOverrunPrevisionsBySharesTakenBack() throws {
        let plan = CatchUpPlan.make(ledger: Self.ledger, focusLineId: nil, userCurrency: .chf)
        let loisirs = try #require(plan.choices.first)
        let gifts = try #require(plan.choices.last)
        let all = plan.raises(for: loisirs)
        #expect(all.map(\.line.id) == ["courses", "sorties"])
        #expect(all.map(\.newAmount) == [664.20, 138])
        let partial = plan.raises(for: gifts)
        #expect(partial.map(\.line.id) == ["courses"])
        #expect(partial.map(\.newAmount) == [640])

        let saved = all.reduce(Self.ledger.replacing(lineId: loisirs.id, amount: loisirs.newAmount)) {
            $0.replacing(lineId: $1.line.id, amount: $1.newAmount)
        }
        let again = CatchUpPlan.make(ledger: saved, focusLineId: nil, userCurrency: .chf)
        #expect(again.overruns.isEmpty)
    }

    @Test func fromOnePrevision_takesBackOnlyItsOverrun() {
        let plan = CatchUpPlan.make(ledger: Self.ledger, focusLineId: "courses", userCurrency: .chf)
        #expect(plan.total == 64.20)
        #expect(plan.choices.map(\.newAmount) == [85.80, 23.80, 60])
        #expect(plan.choices.map(\.coversAll) == [true, true, false])
    }

    /// Transport is untouched and the 102.20 overrun takes all its 88: it would be left at zero,
    /// which the API refuses (a prévision is strictly positive), so it is not offered.
    @Test func untouchedPrevisionTheOverrunWouldEmpty_isNotOffered() {
        let plan = CatchUpPlan.make(ledger: Self.ledger, focusLineId: nil, userCurrency: .chf)
        let zeroed = plan.choices.filter { $0.newAmount <= 0 }
        #expect(!plan.choices.map(\.id).contains("transport"))
        #expect(zeroed.isEmpty)
    }

    @Test func nothingOver_offersNothing() {
        let plan = CatchUpPlan.make(ledger: Self.ledger, focusLineId: "loisirs", userCurrency: .chf)
        #expect(plan.overruns.isEmpty)
        #expect(plan.choices.isEmpty)
        #expect(plan.defaultChoiceId == nil)
    }
}
