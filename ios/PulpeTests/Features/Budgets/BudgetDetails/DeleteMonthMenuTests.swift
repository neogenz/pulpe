import Foundation
@testable import Pulpe
import Testing

/// PUL-361: when "Supprimer ce mois" is offered, and what the confirmation says.
@Suite("DeleteMonthMenu")
@MainActor
struct DeleteMonthMenuTests {
    // MARK: - Future-month gate

    @Test("Only a month after the live period is deletable")
    func isFutureMonth_followsTheLivePeriod() {
        let today = date(2026, 10, 20)

        #expect(isFuture(month: 11, year: 2026, payDay: nil, now: today))
        #expect(isFuture(month: 1, year: 2027, payDay: nil, now: today))
        #expect(!isFuture(month: 10, year: 2026, payDay: nil, now: today))
        #expect(!isFuture(month: 9, year: 2026, payDay: nil, now: today))
        #expect(!isFuture(month: 12, year: 2025, payDay: nil, now: today))
    }

    @Test("A pay day past the 15th moves the live period to the next month")
    func isFutureMonth_payDayShiftsTheLivePeriod() {
        // Quinzaine rule: on 26 October with a pay day of 25, the budget in progress is November.
        let today = date(2026, 10, 26)

        #expect(isFuture(month: 12, year: 2026, payDay: 25, now: today))
        #expect(!isFuture(month: 11, year: 2026, payDay: 25, now: today))
        #expect(!isFuture(month: 10, year: 2026, payDay: 25, now: today))
        // Without the pay day, the same November is still ahead.
        #expect(isFuture(month: 11, year: 2026, payDay: nil, now: today))
    }

    @Test("Before the pay day, the live period is still the current month")
    func isFutureMonth_beforePayDay_keepsTheCurrentMonthLive() {
        let today = date(2026, 10, 20)

        #expect(isFuture(month: 11, year: 2026, payDay: 25, now: today))
        #expect(!isFuture(month: 10, year: 2026, payDay: 25, now: today))
    }

    // MARK: - Confirmation message

    @Test("A month without links only states its counts")
    func message_withoutLinks_statesCountsOnly() {
        let message = DeleteMonthMenu.message(for: impact(forecasts: 12, movements: 0), lines: [], currency: .chf)

        #expect(message == "Ses 12 prévisions partent avec lui. Il n'a encore aucun mouvement.")
    }

    @Test("A linked month names what each linked prévision loses, not the plain ones")
    func message_withLinks_namesTheLinkedLines() {
        var spread = TestDataFactory.createBudgetLine(id: "car", name: "Assurance voiture", amount: 120)
        spread.spreadGroupId = UUID()
        let plain = TestDataFactory.createBudgetLine(id: "rent", name: "Loyer", amount: 1850)

        let message = DeleteMonthMenu.message(
            for: impact(forecasts: 12, movements: 3, spread: 1),
            lines: [spread, plain],
            currency: .chf
        )

        #expect(message.hasPrefix("Ses 12 prévisions partent avec lui. Ses 3 mouvements partent aussi."))
        #expect(message.contains("Assurance voiture y perd sa part lissée (120.00)"))
        #expect(message.hasSuffix("Les autres mois ne changent pas."))
        #expect(!message.contains("Loyer"))
    }

    @Test("A link the loaded lines cannot name still says the month is linked")
    func message_withUnnamedLinks_keepsTheLinkSentence() {
        let message = DeleteMonthMenu.message(
            for: impact(forecasts: 3, movements: 1, withdrawalForecasts: 1, withdrawalMovements: 2),
            lines: [],
            currency: .chf
        )

        #expect(message.hasSuffix("Il est lié à d'autres mois. Les autres mois ne changent pas."))
    }

    // MARK: - Title

    /// Mid-sentence the month keeps its language's own casing: "Supprimer novembre 2026 ?",
    /// not the capitalized header form.
    @Test(arguments: [
        (SupportedLocale.fr, "novembre 2026"),
        (.en, "November 2026"),
        (.de, "November 2026"),
        (.it, "novembre 2026"),
    ])
    func monthLabel_keepsTheLanguagesInSentenceCasing(language: SupportedLocale, expected: String) {
        #expect(DeleteMonthMenu.monthLabel(month: 11, year: 2026, in: language) == expected)
    }

    // MARK: - Helpers

    private func isFuture(month: Int, year: Int, payDay: Int?, now: Date) -> Bool {
        DeleteMonthMenu.isFutureMonth(month: month, year: year, payDayOfMonth: payDay, now: now)
    }

    private func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        Calendar.current.date(from: DateComponents(year: year, month: month, day: day, hour: 12)) ?? .distantPast
    }

    private func impact(
        forecasts: Int,
        movements: Int,
        spread: Int = 0,
        goal: Int = 0,
        withdrawalForecasts: Int = 0,
        withdrawalMovements: Int = 0
    ) -> BudgetDeletionImpact {
        BudgetDeletionImpact(
            forecastCount: forecasts,
            movementCount: movements,
            links: .init(
                spreadForecasts: spread,
                savingsGoalForecasts: goal,
                savingsWithdrawalForecasts: withdrawalForecasts,
                savingsWithdrawalMovements: withdrawalMovements
            )
        )
    }
}
