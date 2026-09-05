@testable import Pulpe
import Testing

/// The Home's « à pointer » deck mixes forecasts and movements. A forecast states its
/// rhythm; the word for it used to close the subtitle, where "Prévu ce mois · Prévu"
/// said the same thing twice. A glyph states it now — but only for a monthly line, so
/// the name carries the word for the reader who cannot see the glyph's absence.
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
        // (Those were the words before the rename; the collision is what killed them.)
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

    /// A ponctuel forecast is marked by the absence of the glyph, and an absence is
    /// silence to VoiceOver — so the spoken name carries the word in both rhythms.
    @Test("the spoken name carries the rhythm a glyph cannot", arguments: [
        (TransactionRecurrence.fixed, "Loyer, Mensuel"),
        (TransactionRecurrence.oneOff, "Loyer, Ponctuel"),
    ])
    func spokenName_forBudgetLine_appendsTheRhythm(
        _ recurrence: TransactionRecurrence,
        _ expected: String
    ) {
        let line = TestDataFactory.createBudgetLine(name: "Loyer", recurrence: recurrence)

        #expect(UncheckedOperationsCard.spokenName(for: .budgetLine(line)) == expected)
    }

    @Test("a movement's spoken name is just its name")
    func spokenName_forTransaction_isTheNameAlone() {
        let transaction = TestDataFactory.createTransaction(name: "Courses")

        #expect(UncheckedOperationsCard.spokenName(for: .transaction(transaction)) == "Courses")
    }
}
