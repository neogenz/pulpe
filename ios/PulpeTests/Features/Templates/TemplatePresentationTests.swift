import Foundation
@testable import Pulpe
import Testing

@Suite("TemplatePresentation", .serialized)
@MainActor
struct TemplatePresentationTests {
    private static func line(
        _ id: String, _ kind: TransactionKind, _ amount: Decimal, recurrence: TransactionRecurrence = .fixed
    ) -> TemplateLine {
        TemplateLine(
            id: id, templateId: "tpl-1", name: id, amount: amount, kind: kind, recurrence: recurrence,
            description: "", createdAt: TestDataFactory.fixedDate, updatedAt: TestDataFactory.fixedDate
        )
    }

    private static let lines = [
        line("salary", .income, 6200),
        line("rent", .expense, 1850),
        line("food", .expense, 600),
        line("japan", .saving, 500),
    ]

    @Test func splitSeparatesSavingsFromExpensesAndLeavesTheRestAvailable() {
        let split = TemplatePresentation.Split(lines: Self.lines)

        #expect(split.income == 6200)
        #expect(split.expenses == 2450)
        #expect(split.savings == 500)
        #expect(split.available == 3250)
    }

    @Test func detailSubtitleSaysHowOftenTheTemplateWasUsed() {
        let standard = BudgetTemplate(
            id: "t", name: "Standard", description: nil, userId: nil, isDefault: true,
            createdAt: TestDataFactory.fixedDate, updatedAt: TestDataFactory.fixedDate
        )
        let festive = BudgetTemplate(
            id: "t2", name: "Fêtes", description: "Cadeaux et repas", userId: nil, isDefault: false,
            createdAt: TestDataFactory.fixedDate, updatedAt: TestDataFactory.fixedDate
        )

        #expect(TemplatePresentation.detailSubtitle(template: standard, usedBudgetCount: 9)?.contains("9") == true)
        let used = TemplatePresentation.detailSubtitle(template: festive, usedBudgetCount: 0)
        #expect(used?.hasPrefix("Cadeaux et repas") == true)
        #expect(TemplatePresentation.detailSubtitle(template: festive, usedBudgetCount: nil) == "Cadeaux et repas")
    }

    @Test func deleteIsExplainedByTheCountOfBudgetsUsingTheTemplate() {
        #expect(TemplatePresentation.deleteSubtitle(usedBudgetCount: 0).contains("Aucun budget"))
        #expect(TemplatePresentation.deleteSubtitle(usedBudgetCount: 9).contains("9"))
        #expect(TemplatePresentation.deleteMessage(lineCount: 13).contains("13"))
    }

    @Test func lineSubtitleAddsTheGoalOnlyWhenLinked() {
        typealias Presentation = TemplatePresentation
        #expect(Presentation.lineSubtitle(recurrence: .fixed, isLinkedToGoal: false) == "Mensuel")
        #expect(Presentation.lineSubtitle(recurrence: .oneOff, isLinkedToGoal: false) == "Ponctuel")
        let linked = Presentation.lineSubtitle(recurrence: .fixed, isLinkedToGoal: true)
        #expect(linked.hasPrefix("Mensuel · "))
    }

    @Test func availableImpactMovesOnlyWhenTheLineChanges() throws {
        let unchanged = TemplatePresentation.availableImpact(
            lines: Self.lines, lineId: "food", amount: 600, kind: .expense
        )
        #expect(unchanged == nil)

        let raised = try #require(
            TemplatePresentation.availableImpact(lines: Self.lines, lineId: "food", amount: 700, kind: .expense)
        )
        #expect(raised.before == 3250)
        #expect(raised.after == 3150)

        let reclassified = try #require(
            TemplatePresentation.availableImpact(lines: Self.lines, lineId: "food", amount: 600, kind: .income)
        )
        #expect(reclassified.after == 4450)
    }

    @Test func propagationNamesTheFollowingMonthsOnlyWhenSeveralBudgetsAreReached() {
        #expect(TemplatePresentation.propagationScope(monthName: "novembre", budgetCount: 1) == "novembre")
        #expect(TemplatePresentation.propagationScope(monthName: "novembre", budgetCount: 3).contains("mois suivants"))
        #expect(TemplatePresentation.propagationTitle(monthName: nil).contains("mois déjà créés"))
    }

    @Test func propagationOffersTheMonthImpactWhenTheMonthFollowsTheLine() throws {
        let monthLine = TestDataFactory.createBudgetLine(id: "bl-food", name: "food", amount: 600)
        let income = TestDataFactory.createBudgetLine(id: "bl-salary", name: "salary", amount: 6200, kind: .income)
        let ledger = MonthLedger(lines: [income, monthLine], transactions: [], rollover: 0)

        let propagation = TemplateLinePropagation.make(
            monthLine: monthLine, monthName: "novembre", ledger: ledger,
            budgetCount: 3, edit: .init(name: "food", amount: 700, kind: .expense)
        )

        let available = try #require(propagation.available)
        #expect(available.before == 5600)
        #expect(available.after == 5500)
        #expect(propagation.monthAmount == 600)
        #expect(propagation.bothDetail(currency: .chf).contains("mois suivants"))

        let detached = TemplateLinePropagation.make(
            monthLine: nil, monthName: "novembre", ledger: ledger,
            budgetCount: 3, edit: .init(name: "food", amount: 700, kind: .expense)
        )
        #expect(detached.available == nil)
        #expect(detached.monthName == nil)
    }
}
