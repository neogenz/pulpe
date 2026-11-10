import Foundation
@testable import Pulpe
import Testing

struct BudgetListPresentationTests {
    private func budget(_ id: String, month: Int, year: Int = 2026) -> BudgetSparse {
        TestDataFactory.createBudgetSparse(id: id, month: month, year: year)
    }

    @Test func sectionsSplitAroundTheCurrentPeriodWithClosedNewestFirst() {
        let budgets = [3, 1, 11, 12, 10, 2].map { budget("b\($0)", month: $0) }
        let sections = BudgetListPresentation.sections(
            of: budgets, currentPeriod: BudgetPeriod(month: 11, year: 2026)
        )

        #expect(sections.current.map(\.month) == [11])
        #expect(sections.upcoming.map(\.month) == [12])
        #expect(sections.closed.map(\.month) == [10, 3, 2, 1])
    }

    @Test func aPastYearIsAllClosedAndAFutureYearAllUpcoming() {
        let current = BudgetPeriod(month: 11, year: 2026)
        let past = BudgetListPresentation.sections(of: [budget("a", month: 12, year: 2025)], currentPeriod: current)
        let future = BudgetListPresentation.sections(of: [budget("b", month: 1, year: 2027)], currentPeriod: current)

        #expect(past.closed.count == 1 && past.current.isEmpty && past.upcoming.isEmpty)
        #expect(future.upcoming.count == 1 && future.current.isEmpty && future.closed.isEmpty)
    }

    @Test func payDaySubtitleOnlyWhenMonthsDoNotFollowTheCalendar() {
        #expect(BudgetListPresentation.payDaySubtitle(payDayOfMonth: nil) == nil)
        #expect(BudgetListPresentation.payDaySubtitle(payDayOfMonth: 1) == nil)
        let subtitle = BudgetListPresentation.payDaySubtitle(payDayOfMonth: 25)
        #expect(subtitle?.contains("25") == true)
        #expect(subtitle?.contains("24") == true)
    }

    @Test func recapSentenceEstimatesOnlyAYearNotOver() {
        let current = BudgetListPresentation.recapSentence(year: 2026, budgetCount: 12, isPastYear: false)
        let past = BudgetListPresentation.recapSentence(year: 2025, budgetCount: 12, isPastYear: true)
        let partial = BudgetListPresentation.recapSentence(year: 2026, budgetCount: 5, isPastYear: true)

        #expect(current.contains("2026"))
        #expect(current.count > past.count)
        #expect(past.contains("2025"))
        #expect(partial.contains("5"))
        #expect(!BudgetListPresentation.recapSentence(year: 2026, budgetCount: 0, isPastYear: false).isEmpty)
    }

    @Test func usageMeasuresExpensesAgainstIncomePlusRollover() {
        let sparse = TestDataFactory.createBudgetSparse(totalExpenses: 800, totalIncome: 900, rollover: 100)
        #expect(BudgetListPresentation.usage(of: sparse) == 0.8)
        #expect(BudgetListPresentation.usage(of: TestDataFactory.createBudgetSparse()) == 0)
        #expect(BudgetListPresentation.usageLabel(0.8).contains("80"))
    }

    @Test func templateSubtitleLeadsWithDefaultThenDescriptionThenLineCount() {
        let standard = template(isDefault: true, description: "Ignored")
        let summer = template(isDefault: false, description: "Juillet et août")
        let bare = template(isDefault: false, description: "  ")

        #expect(BudgetListPresentation.templateSubtitle(standard, lineCount: 11)?.contains("11") == true)
        #expect(BudgetListPresentation.templateSubtitle(standard, lineCount: nil)?.contains("Ignored") == false)
        #expect(BudgetListPresentation.templateSubtitle(summer, lineCount: nil) == "Juillet et août")
        #expect(BudgetListPresentation.templateSubtitle(bare, lineCount: nil) == nil)
    }

    private func template(isDefault: Bool, description: String?) -> BudgetTemplate {
        BudgetTemplate(
            id: "t", name: "Mois standard", description: description, userId: nil,
            isDefault: isDefault, createdAt: .distantPast, updatedAt: .distantPast
        )
    }
}
