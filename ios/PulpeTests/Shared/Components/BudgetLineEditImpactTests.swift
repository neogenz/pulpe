import Foundation
@testable import Pulpe
import Testing

@Suite("BudgetLineEditImpact")
struct BudgetLineEditImpactTests {
    /// Revenu 5000, Courses planned 600 with `spent` already through it.
    private static func month(spent: Decimal) -> (MonthLedger, BudgetLine) {
        let income = TestDataFactory.createBudgetLine(id: "salary", amount: 5000, kind: .income)
        let courses = TestDataFactory.createBudgetLine(id: "courses", name: "Courses", amount: 600)
        let txs = spent > 0
            ? [TestDataFactory.createTransaction(id: "tx", budgetLineId: "courses", amount: spent)]
            : []
        return (MonthLedger(lines: [income, courses], transactions: txs, rollover: 0), courses)
    }

    @Test func raise_aboveSpent_onlyThePartAboveSpendingLeaves() {
        let (ledger, line) = Self.month(spent: 664.20)
        let impact = BudgetLineEditImpact.compute(ledger: ledger, line: line, amount: 700, kind: .expense)
        #expect(impact.figures.before == 4335.80)
        #expect(impact.figures.after == 4300)
        #expect(impact.figures.delta == -35.80)
        #expect(impact.figures.tone == .over)
        #expect(impact.note(currency: .chf)?.contains("35.80") == true)
    }

    @Test func lower_aboveSpent_onlyTheUnspentPartComesBack() {
        let (ledger, line) = Self.month(spent: 500)
        let impact = BudgetLineEditImpact.compute(ledger: ledger, line: line, amount: 400, kind: .expense)
        #expect(impact.figures.delta == 100)
        #expect(impact.figures.tone == .ok)
        #expect(impact.isCutBySpending)
    }

    @Test func raise_stillBelowSpent_disponibleDoesNotMove() {
        let (ledger, line) = Self.month(spent: 664.20)
        let impact = BudgetLineEditImpact.compute(ledger: ledger, line: line, amount: 650, kind: .expense)
        #expect(impact.figures.delta == 0)
        #expect(impact.figures.tone == .neutral)
        #expect(impact.note(currency: .chf) != nil)
    }

    @Test func sameAmount_nothingMovesAndNoNote() {
        let (ledger, line) = Self.month(spent: 664.20)
        let impact = BudgetLineEditImpact.compute(ledger: ledger, line: line, amount: 600, kind: .expense)
        #expect(impact.figures.delta == 0)
        #expect(impact.note(currency: .chf) == nil)
    }

    @Test func raise_withoutSpending_wholeRaiseLeavesWithoutNote() {
        let (ledger, line) = Self.month(spent: 0)
        let impact = BudgetLineEditImpact.compute(ledger: ledger, line: line, amount: 700, kind: .expense)
        #expect(impact.figures.delta == -100)
        #expect(impact.note(currency: .chf) == nil)
    }
}
