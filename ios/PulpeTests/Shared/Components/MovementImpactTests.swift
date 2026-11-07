import Foundation
@testable import Pulpe
import Testing

/// What a draft movement or prévision does to the disponible, and which prévisions it can be filed under.
struct MovementImpactTests {
    private static func line(_ id: String, _ amount: Decimal, kind: TransactionKind = .expense) -> BudgetLine {
        BudgetLine(
            id: id,
            budgetId: "budget-1",
            templateLineId: nil,
            savingsGoalId: nil,
            name: id,
            amount: amount,
            kind: kind,
            recurrence: .fixed,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: TestDataFactory.fixedDate,
            updatedAt: TestDataFactory.fixedDate
        )
    }

    private let lines = [
        line("salaire", 3000, kind: .income), line("courses", 400), line("epargne", 200, kind: .saving),
    ]

    private func impact(_ kind: TransactionKind, _ amount: Decimal, lineId: String?) -> MovementImpact {
        MovementImpact.compute(
            lines: lines, transactions: [], rollover: 0,
            draft: .init(kind: kind, amount: amount, lineId: lineId)
        )
    }

    @Test("an amount inside its prévision leaves the disponible alone and shrinks the line")
    func insideTheLine_isNeutral() {
        let result = impact(.expense, 50, lineId: "courses")

        #expect(result.tone == .neutral)
        #expect(result.delta == 0)
        #expect(result.lineBefore == 400)
        #expect(result.lineAfter == 350)
    }

    @Test("what goes past the prévision comes out of the disponible")
    func pastTheLine_lowersTheDisponible() {
        let result = impact(.expense, 450, lineId: "courses")

        #expect(result.tone == .over)
        #expect(result.delta == -50)
    }

    @Test("an imprévu lowers the disponible by its whole amount")
    func unplannedExpense_lowersByTheAmount() {
        let result = impact(.expense, 18.6, lineId: nil)

        #expect(result.tone == .over)
        #expect(result.delta == -18.6)
        #expect(result.lineBefore == nil)
    }

    @Test("an unplanned income raises the disponible")
    func unplannedIncome_raises() {
        let result = impact(.income, 100, lineId: nil)

        #expect(result.tone == .ok)
        #expect(result.delta == 100)
    }

    @Test("a new prévision lowers the disponible by its amount")
    func forecast_lowersByTheAmount() {
        let ledger = MonthLedger(lines: lines, transactions: [], rollover: 0)

        let result = MovementImpact.forecast(ledger: ledger, budgetId: "budget-1", kind: .expense, amount: 140)

        #expect(result.delta == -140)
        #expect(result.tone == .over)
    }

    @Test("deleting an overspent prévision leaves the disponible alone: its movements still count")
    func between_deletingAnOverspentLine_isNeutral() {
        let spent = [
            TestDataFactory.createTransaction(id: "t1", budgetId: "budget-1", budgetLineId: "courses", amount: 450),
        ]
        let detached = [TestDataFactory.createTransaction(id: "t1", budgetId: "budget-1", amount: 450)]
        let before = MonthLedger(lines: lines, transactions: spent, rollover: 0)
        let after = MonthLedger(lines: lines.filter { $0.id != "courses" }, transactions: detached, rollover: 0)

        let result = MovementImpact.between(before, after)

        #expect(result.delta == 0)
        #expect(result.after == 2350)
    }

    @Test("a movement is only offered the prévisions of its own kind")
    func choices_keepTheSameKind() {
        let eligible = MovementLineChoices.eligible(lines: lines, kind: .expense)

        #expect(eligible.map(\.id) == ["courses"])
    }
}
