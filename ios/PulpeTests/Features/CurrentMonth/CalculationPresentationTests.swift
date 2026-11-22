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
            budgetLines: Self.lines, transactions: Self.transactions,
            rollover: rollover, reportTitle: "Report d'octobre"
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
            budgetLines: Self.lines, transactions: [], rollover: 0, reportTitle: "Report de septembre"
        )

        #expect(rows.map(\.title) == ["Salaire", "Dépenses prévues", "Épargne prévue"])
        #expect(rows.reduce(.zero) { $0 + $1.amount } == Decimal(1_012))
    }

    @Test func gapCauses_namesOverrunsThenUnplannedOutflows_savingsIncluded() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "courses", name: "Courses", amount: 400),
            TestDataFactory.createBudgetLine(id: "pilier", name: "3e pilier", amount: 500, kind: .saving),
            TestDataFactory.createBudgetLine(id: "sorties", name: "Sorties", amount: 100),
            TestDataFactory.createBudgetLine(id: "salaire", name: "Salaire", amount: 6_000, kind: .income),
        ]
        let transactions = [
            TestDataFactory.createTransaction(
                id: "t1", budgetLineId: "courses", amount: Decimal(string: "464.20") ?? 0
            ),
            TestDataFactory.createTransaction(id: "t2", budgetLineId: "pilier", amount: 600, kind: .saving),
            TestDataFactory.createTransaction(id: "t3", budgetLineId: "sorties", amount: 80),
            TestDataFactory.createTransaction(id: "t4", budgetLineId: "salaire", amount: 6_500, kind: .income),
            TestDataFactory.createTransaction(id: "t6", name: "Tirelire", amount: 50, kind: .saving),
            TestDataFactory.createTransaction(id: "t7", name: "Remboursement", amount: 30, kind: .income),
        ]

        let sentence = CalculationPresentation.gapCauses(
            budgetLines: lines, transactions: transactions, currency: .chf
        )

        #expect(sentence == "3e pilier +100.00, Courses +64.20 et Tirelire 50.00.")
        #expect(CalculationPresentation.gapCauses(budgetLines: [], transactions: [], currency: .chf) == nil)
    }

    @Test func listed_countsBeyondThree() {
        #expect(CalculationPresentation.listed(["a"]) == "a")
        #expect(CalculationPresentation.listed(["a", "b"]) == "a et b")
        #expect(CalculationPresentation.listed(["a", "b", "c", "d", "e"]) == "a, b et 3 autres")
    }

    @Test func reportTitle_elidesBeforeAVowel() {
        #expect(ReportWording.reportTitle(of: 10) == "Report d'octobre")
        #expect(ReportWording.reportTitle(of: 9) == "Report de septembre")
        #expect(ReportWording.reportTitle(of: 8) == "Report d'août")
    }

    @Test func sourceMonth_isTheLastBudgetBefore_skippedMonthsIncluded() {
        let budgets = [
            TestDataFactory.createBudgetSparse(id: "dec", month: 12, year: 2026),
            TestDataFactory.createBudgetSparse(id: "aug", month: 8, year: 2026),
            TestDataFactory.createBudgetSparse(id: "nov", month: 11, year: 2026),
            TestDataFactory.createBudgetSparse(id: "dec-old", month: 12, year: 2025),
        ]

        // October was skipped: November carries over from August.
        #expect(ReportWording.sourceMonth(before: 11, year: 2026, among: budgets) == 8)
        #expect(ReportWording.sourceMonth(before: 1, year: 2027, among: budgets) == 12)
        #expect(ReportWording.sourceMonth(before: 8, year: 2026, among: budgets) == 12)
        #expect(ReportWording.sourceMonth(before: 12, year: 2025, among: budgets) == nil)
        #expect(ReportWording.reportTitle(of: nil) == "Report du mois précédent")
    }

    @Test func formulaAmount_signsByValue() {
        #expect(Decimal(6_200).asFormulaAmount(for: .chf) == "+6\u{2019}200.00")
        #expect((-(Decimal(string: "6.50") ?? 0)).asFormulaAmount(for: .chf) == "\u{2212}6.50")
        #expect(Decimal.zero.asFormulaAmount(for: .chf) == "0.00")
    }
}
