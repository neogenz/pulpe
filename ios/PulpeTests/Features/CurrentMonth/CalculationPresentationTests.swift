import Foundation
@testable import Pulpe
import Testing

/// « Le calcul »: the formula's lines must add up to the disponible the hero shows, and the
/// sentence under « Écart au plan » names what moved the month.
@Suite("Calculation presentation")
struct CalculationPresentationTests {
    private static let lines = [
        TestDataFactory.createBudgetLine(id: "salary", name: "Salaire", amount: 6_200, kind: .income),
        TestDataFactory.createBudgetLine(id: "groceries", name: "Courses", amount: 400, kind: .expense),
        TestDataFactory.createBudgetLine(id: "rent", name: "Loyer", amount: 3_700, kind: .expense),
        TestDataFactory.createBudgetLine(id: "japan", name: "Japon", amount: 1_088, kind: .saving),
        TestDataFactory.createBudgetLine(id: "rollover", name: "Report", amount: 340, kind: .income, isRollover: true),
    ]
    private static let transactions = [
        TestDataFactory.createTransaction(
            id: "migros", budgetLineId: "groceries", name: "Migros", amount: Decimal(string: "464.20") ?? 0
        ),
        TestDataFactory.createTransaction(id: "cafe", name: "Café Lomi", amount: Decimal(string: "6.50") ?? 0),
        TestDataFactory.createTransaction(id: "refund", name: "Remboursement", amount: 20, kind: .income),
    ]

    @Test func rows_addUpToTheDisponible() {
        let rollover: Decimal = 340
        let rows = CalculationPresentation.rows(
            budgetLines: Self.lines, transactions: Self.transactions, rollover: rollover, previousMonth: 10
        )
        let metrics = BudgetFormulas.calculateAllMetrics(
            budgetLines: Self.lines, transactions: Self.transactions, rollover: rollover
        )

        #expect(rows.reduce(.zero) { $0 + $1.amount } == metrics.remaining)
        #expect(rows.map(\.amount) == [
            6_200, 20, 340, -(Decimal(string: "4164.20") ?? 0), -(Decimal(string: "6.50") ?? 0), -1_088,
        ])
        #expect(rows.map(\.title) == [
            "Salaire", "Hors prévision", "Report d'octobre", "Dépenses prévues", "Hors prévision", "Épargne prévue",
        ])
        #expect(rows[3].caption == "Le plus haut entre prévu et dépensé")
    }

    @Test func rows_withoutReportOrUnplanned_dropThoseLines() {
        let rows = CalculationPresentation.rows(
            budgetLines: Self.lines, transactions: [], rollover: 0, previousMonth: 9
        )

        #expect(rows.map(\.title) == ["Salaire", "Dépenses prévues", "Épargne prévue"])
        #expect(rows.reduce(.zero) { $0 + $1.amount } == Decimal(1_012))
    }

    @Test func gapCauses_namesOverrunsThenUnplannedOutflows() {
        let cafe = TestDataFactory.createTransaction(name: "Café Lomi", amount: Decimal(string: "6.50") ?? 0)
        let sentence = CalculationPresentation.gapCauses(
            overruns: [("Courses", Decimal(string: "64.20") ?? 0), ("Sorties", 38)],
            unplannedOutflows: [cafe],
            currency: .chf
        )

        #expect(sentence == "Courses +64.20, Sorties +38.00 et Café Lomi 6.50.")
        #expect(CalculationPresentation.gapCauses(overruns: [], unplannedOutflows: [], currency: .chf) == nil)
    }

    @Test func listed_countsBeyondThree() {
        #expect(CalculationPresentation.listed(["a"]) == "a")
        #expect(CalculationPresentation.listed(["a", "b"]) == "a et b")
        #expect(CalculationPresentation.listed(["a", "b", "c", "d", "e"]) == "a, b et 3 autres")
    }

    @Test func reportTitle_elidesBeforeAVowel() {
        #expect(CalculationPresentation.reportTitle(of: 10) == "Report d'octobre")
        #expect(CalculationPresentation.reportTitle(of: 9) == "Report de septembre")
        #expect(CalculationPresentation.reportTitle(of: 8) == "Report d'août")
    }

    @Test func formulaAmount_signsByValue() {
        #expect(Decimal(6_200).asFormulaAmount(for: .chf) == "+6\u{2019}200.00")
        #expect((-(Decimal(string: "6.50") ?? 0)).asFormulaAmount(for: .chf) == "\u{2212}6.50")
        #expect(Decimal.zero.asFormulaAmount(for: .chf) == "0.00")
    }
}
