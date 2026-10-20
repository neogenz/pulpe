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
        let message = DeleteMonthMenu.message(for: impact(forecasts: 5, movements: 2))

        #expect(message == "Ses prévisions (5) et ses mouvements (2) seront supprimés. Cette action est irréversible.")
    }

    @Test("A linked month adds the links sentence with the counts of each link kind")
    func message_withLinks_listsOnlyTheLinkedKinds() {
        let message = DeleteMonthMenu.message(for: impact(forecasts: 5, movements: 2, spread: 2, goal: 1))

        #expect(message.hasPrefix("Ses prévisions (5) et ses mouvements (2) seront supprimés."))
        #expect(message.contains(
            "Ce mois est aussi lié à d'autres mois : dépense lissée (2), objectif d'épargne (1). "
                + "Les autres mois gardent leur part."
        ))
        #expect(!message.contains("retrait d'épargne"))
    }

    @Test("The withdrawal label adds withdrawal forecasts and movements together")
    func message_withdrawal_sumsForecastsAndMovements() {
        let message = DeleteMonthMenu.message(
            for: impact(forecasts: 3, movements: 1, withdrawalForecasts: 1, withdrawalMovements: 2)
        )

        #expect(message.contains("retrait d'épargne (3)"))
        #expect(!message.contains("dépense lissée"))
        #expect(!message.contains("objectif d'épargne"))
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
