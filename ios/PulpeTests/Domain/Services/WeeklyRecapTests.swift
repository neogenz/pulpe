import Foundation
@testable import Pulpe
import Testing

/// October 2026 budget, calendar-month period (no pay-day). The recap fires Monday 19th,
/// so "last week" is 12–18 and this week covers period days 19–25 of 31.
struct WeeklyRecapTests {
    @Test func make_weekWithHistory_summarizesItAndPlansTheNext() throws {
        let recap = WeeklyRecap.make(
            on: try date(day: 19, hour: 8, minute: 30),
            transactions: try history,
            current: try october,
            payDayOfMonth: nil
        )

        // 13th (rent) and 14th (groceries); the 1st and September stay out.
        #expect(recap.movementCount == 2)
        // remaining 2600 over the 13 days left (19–31) = 200/day, times 7.
        #expect(recap.weekAllowance == 1400)
        // Free expenses only, over the 4 weeks before: (200 + 100) / 4. Rent is planned.
        #expect(recap.usualWeekSpending == 75)
        // Unchecked lines usually pointed on period days 19–25, earliest first. The phone
        // (day 21) is already checked; insurance (day 5) belongs to another week.
        #expect(recap.expectedLineNames == ["Internet", "Loyer"])
    }

    @Test func make_pastPayDay_doesNotProjectTheClosedPeriod() throws {
        let recap = WeeklyRecap.make(
            on: try date(month: 11, day: 2, hour: 8, minute: 30),
            transactions: try history,
            current: try october,
            payDayOfMonth: nil
        )

        #expect(recap.weekAllowance == nil)
        #expect(recap.expectedLineNames.isEmpty)
    }

    @Test func make_withoutFourWeeksOfHistory_hasNoHabit() throws {
        let monthStart = try date(day: 1)
        let recent = try history.filter { $0.transactionDate >= monthStart }

        let recap = WeeklyRecap.make(
            on: try date(day: 19, hour: 8, minute: 30),
            transactions: recent,
            current: try october,
            payDayOfMonth: nil
        )

        #expect(recap.usualWeekSpending == nil)
    }

    @Test func make_exhaustedBudget_leavesNoAllowance() throws {
        let details = try october
        let overspent = BudgetDetails(
            budget: details.budget,
            transactions: details.transactions + [try tx("big", 5000, on: date(day: 15))],
            budgetLines: details.budgetLines
        )

        let recap = WeeklyRecap.make(
            on: try date(day: 19, hour: 8, minute: 30),
            transactions: [],
            current: overspent,
            payDayOfMonth: nil
        )

        #expect(recap.weekAllowance == 0)
    }

    @Test(arguments: [
        (12, 7, 12),  // Monday before 8:30 → the same morning
        (12, 9, 19),  // Monday after 8:30 → next week
        (14, 20, 19),  // Wednesday → next Monday
    ])
    func nextWeeklyRecapDate_anyMoment_isTheComingMondayMorning(day: Int, hour: Int, expectedDay: Int) throws {
        let next = NotificationScheduler.nextWeeklyRecapDate(after: try date(day: day, hour: hour))
        let expected = try date(day: expectedDay, hour: 8, minute: 30)

        #expect(next == expected)
    }

    @Test func weeklyRecapBody_previewsAlwaysShown_carriesNoAmountsOrForecasts() throws {
        let recap = WeeklyRecap(
            movementCount: 2, weekAllowance: 1400, usualWeekSpending: 75, expectedLineNames: ["Loyer"]
        )

        let hidden = NotificationScheduler.weeklyRecapBody(recap, currency: .chf, showDetails: false)
        let shown = NotificationScheduler.weeklyRecapBody(recap, currency: .chf, showDetails: true)

        #expect(!hidden.contains("CHF") && !hidden.contains("Loyer"))
        #expect(shown.contains("1’400 CHF") && shown.contains("75 CHF") && shown.contains("Loyer"))
        // The collapsed banner's two lines must carry the week ahead, not last week's count.
        #expect(shown.hasPrefix("Cette semaine : environ 1’400 CHF"))
    }

    // MARK: - Fixture

    private var october: BudgetDetails {
        get throws {
            let lines = [
                TestDataFactory.createBudgetLine(
                    id: "salary", name: "Salaire", amount: 4610, kind: .income, isChecked: true
                ),
                TestDataFactory.createBudgetLine(id: "rent", name: "Loyer", amount: 1500),
                TestDataFactory.createBudgetLine(id: "internet", name: "Internet", amount: 60),
                TestDataFactory.createBudgetLine(id: "insurance", name: "Assurance", amount: 300),
                TestDataFactory.createBudgetLine(id: "phone", name: "Téléphone", amount: 50, isChecked: true),
            ]
            // Income 4610 − lines 1910 − free groceries 100 = 2600 remaining.
            let monthStart = try date(day: 1)
            return BudgetDetails(
                budget: TestDataFactory.createBudget(month: 10, year: 2026),
                transactions: try history.filter { $0.transactionDate >= monthStart },
                budgetLines: lines,
                checkingDays: ["internet": 19, "rent": 20, "phone": 21, "insurance": 5]
            )
        }
    }

    private var history: [Transaction] {
        get throws {
            [
                try tx("salary", 4610, on: date(day: 1), kind: .income, line: "salary"),
                try tx("rent", 1500, on: date(day: 13), line: "rent"),
                try tx("groceries", 100, on: date(day: 14)),
                try tx("september", 200, on: date(month: 9, day: 25)),
            ]
        }
    }

    private func tx(
        _ id: String,
        _ amount: Decimal,
        on day: Date,
        kind: TransactionKind = .expense,
        line: String? = nil
    ) -> Transaction {
        Transaction(
            id: id, budgetId: "test-budget-1", budgetLineId: line, name: id, amount: amount, kind: kind,
            transactionDate: day, category: nil, checkedAt: nil, createdAt: day, updatedAt: day
        )
    }

    private func date(month: Int = 10, day: Int, hour: Int = 12, minute: Int = 0) throws -> Date {
        try #require(Calendar.current.date(
            from: DateComponents(year: 2026, month: month, day: day, hour: hour, minute: minute)
        ))
    }
}
