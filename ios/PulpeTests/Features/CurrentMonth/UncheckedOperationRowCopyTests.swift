@testable import Pulpe
import Testing

/// The Home's « à pointer » deck mixes forecasts and movements. A forecast states its
/// rhythm; the word for it used to close the subtitle, where "Prévu ce mois · Prévu"
/// said the same thing twice. The glyph states it now, so the sentence stops at the month.
@Suite("Unchecked operation row copy")
struct UncheckedOperationRowCopyTests {
    @Test("a forecast says the month and nothing about its rhythm", arguments: [
        TransactionRecurrence.fixed,
        TransactionRecurrence.oneOff
    ])
    func subtitle_forBudgetLine_dropsTheRecurrenceClause(_ recurrence: TransactionRecurrence) {
        let line = TestDataFactory.createBudgetLine(recurrence: recurrence)

        let subtitle = UncheckedOperationsCard.subtitle(for: .budgetLine(line))

        // The clause is gone, separator included — the sentence used to end on
        // "· Récurrent", or on "· Prévu", which repeated the word it opens with.
        #expect(subtitle == "Prévu ce mois")
        #expect(!subtitle.contains(" · "))
    }

    @Test("a forecast carries its rhythm for the glyph beside the subtitle", arguments: [
        TransactionRecurrence.fixed,
        TransactionRecurrence.oneOff
    ])
    func recurrence_forBudgetLine_isTheLineOwn(_ recurrence: TransactionRecurrence) {
        let line = TestDataFactory.createBudgetLine(recurrence: recurrence)

        #expect(UncheckedOperationsCard.recurrence(for: .budgetLine(line)) == recurrence)
    }

    @Test("a movement has no rhythm to show")
    func recurrence_forTransaction_isNil() {
        let transaction = TestDataFactory.createTransaction()

        #expect(UncheckedOperationsCard.recurrence(for: .transaction(transaction)) == nil)
        #expect(UncheckedOperationsCard.subtitle(for: .transaction(transaction)).hasPrefix("Noté"))
    }
}
