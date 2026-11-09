import Foundation
@testable import Pulpe
import Testing

/// V2 boards 14, 16 and 5: what the spread tiles carry, the spread's impact on M0, the
/// « Plutôt lisser » candidate, and the countdown of a month that has not started.
@Suite("Spread and upcoming-month presentation")
@MainActor
struct SpreadExistingPresentationTests {
    private let ledger = MonthLedger(
        lines: [
            TestDataFactory.createBudgetLine(id: "salary", amount: 3000, kind: .income),
            TestDataFactory.createBudgetLine(id: "car", name: "Assurance voiture", amount: 1440, recurrence: .oneOff),
            TestDataFactory.createBudgetLine(id: "gift", name: "Cadeau", amount: 80, recurrence: .oneOff),
            TestDataFactory.createBudgetLine(id: "rent", name: "Loyer", amount: 1850),
        ],
        transactions: [],
        rollover: 0
    )

    @Test func tile_carriesItsTranche_andNothingWhenSkipped() {
        let calc = SpreadExistingCalculator(anchorMonth: 11, anchorYear: 2026)
        calc.setEnd(SpreadMonth(year: 2027, month: 10))
        let december = SpreadMonth(year: 2026, month: 12)
        #expect(calc.amount(for: december, total: 1440) == 120)
        calc.toggle(december)
        #expect(calc.amount(for: december, total: 1440) == nil)
        #expect(calc.amount(for: calc.start, total: 1440) == Decimal(string: "130.91"))
    }

    @Test func spreadingALine_keepsOnlyTheFirstTrancheInM0() {
        let source = SpreadExistingSource(
            id: "car", sourceType: .budgetLine, kind: .expense, name: "Assurance voiture",
            total: 1440, month: 11, year: 2026
        )
        let impact = source.impact(share: 120, on: ledger)
        #expect(impact.before == -370)
        #expect(impact.after == 950)
    }

    @Test func spreadingALine_freesItsRealMovements() {
        let source = SpreadExistingSource(
            id: "trip", sourceType: .budgetLine, kind: .expense, name: "Voyage", total: 1200, month: 11, year: 2026
        )
        let allocated = MonthLedger(
            lines: [TestDataFactory.createBudgetLine(id: "trip", name: "Voyage", amount: 1200, recurrence: .oneOff)],
            transactions: [TestDataFactory.createTransaction(id: "t", budgetLineId: "trip", amount: 300)],
            rollover: 0
        )
        let impact = source.impact(share: 100, on: allocated)
        #expect(impact.after - impact.before == 800)
    }

    @Test func spreadInstead_isTheLargestSpreadableExpense() {
        let candidate = SpreadExistingSource.largestSpreadableExpense(in: ledger, month: 11, year: 2026)
        #expect(candidate?.id == "car")
        #expect(candidate?.total == 1440)
        let fixedOnly = MonthLedger(lines: [ledger.lines[3]], transactions: [], rollover: 0)
        #expect(SpreadExistingSource.largestSpreadableExpense(in: fixedOnly, month: 11, year: 2026) == nil)
    }

    @Test func upcomingMonth_countsDaysUntilItStarts() throws {
        let now = try #require(Calendar.current.date(from: DateComponents(year: 2026, month: 11, day: 10)))
        #expect(BudgetDetailsView.daysUntilStart(month: 12, year: 2026, payDayOfMonth: nil, now: now) == 21)
        #expect(BudgetDetailsView.daysUntilStart(month: 11, year: 2026, payDayOfMonth: nil, now: now) == nil)
        let subtitle = BudgetDetailsView.periodSubtitle(month: 12, year: 2026, payDayOfMonth: nil, now: now)
        #expect(subtitle.contains("21"))
    }
}
