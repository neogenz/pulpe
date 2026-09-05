import Foundation
@testable import Pulpe
import Testing

/// The Home row used to spell its recurrence out — but only while nothing had
/// been spent on it. These lock the fix: the word leaves the text in every
/// state, so the glyph beside it is the single place the provenance is stated.
@Suite("Budget line row presentation")
struct BudgetLineRowPresentationTests {
    private func consumption(allocated: Decimal, available: Decimal, percentage: Double) -> BudgetFormulas.Consumption {
        BudgetFormulas.Consumption(allocated: allocated, available: available, percentage: percentage)
    }

    @Test(
        "the tertiary text never spells the recurrence out, consumed or not",
        arguments: [TransactionRecurrence.fixed, .oneOff]
    )
    func tertiaryText_whateverTheState_omitsTheRecurrenceWord(recurrence: TransactionRecurrence) {
        let line = TestDataFactory.createBudgetLine(amount: 1450, recurrence: recurrence)

        let untouched = BudgetLineRow.tertiaryText(
            line: line,
            consumption: consumption(allocated: 0, available: 1450, percentage: 0),
            currency: .chf
        )
        let consumed = BudgetLineRow.tertiaryText(
            line: line,
            consumption: consumption(allocated: 180, available: 1270, percentage: 12),
            currency: .chf
        )

        // Both states must actually say something: a regression to `nil` would satisfy
        // a bare `!contains` on either of them without stating anything at all.
        #expect(untouched == "sur \(Decimal(1450).asCurrency(.chf))")
        #expect(consumed == "\(Decimal(180).asAdaptiveCurrency(.chf)) dépensés · 12% utilisé")
        for text in [untouched, consumed] {
            #expect(text?.contains(recurrence.label) == false)
        }
    }

    @Test("an untouched expense still states what it was planned for")
    func tertiaryText_whenUntouchedExpense_statesThePlannedAmount() {
        let line = TestDataFactory.createBudgetLine(amount: 1450, kind: .expense)
        // Grouping and decimal separators follow the simulator's region, so the
        // assertion holds the sentence, never the digits.
        let text = BudgetLineRow.tertiaryText(
            line: line,
            consumption: consumption(allocated: 0, available: 1450, percentage: 0),
            currency: .chf
        )

        #expect(text == "sur \(Decimal(1450).asCurrency(.chf))")
        #expect(text?.hasPrefix("sur ") == true)
    }

    /// Ponctuel is the case that matters: with no sentence and no `repeat` glyph either,
    /// the tertiary line has nothing at all to draw, and the row must drop it rather than
    /// keep an empty one — the `VStack` pads an empty child on both sides.
    @Test(
        "an untouched income or saving says nothing on the tertiary line",
        arguments: [TransactionKind.income, .saving],
        [TransactionRecurrence.fixed, .oneOff]
    )
    func tertiaryText_whenUntouchedIncomeOrSaving_returnsNil(
        kind: TransactionKind,
        recurrence: TransactionRecurrence
    ) {
        let line = TestDataFactory.createBudgetLine(amount: 4200, kind: kind, recurrence: recurrence)

        #expect(
            BudgetLineRow.tertiaryText(
                line: line,
                consumption: consumption(allocated: 0, available: 4200, percentage: 0),
                currency: .chf
            ) == nil
        )
    }

    @Test("a consumed income says what it received, like any other kind")
    func tertiaryText_whenConsumedIncome_fallsBackOnTheConsumptionSummary() {
        let line = TestDataFactory.createBudgetLine(amount: 4200, kind: .income)

        #expect(
            BudgetLineRow.tertiaryText(
                line: line,
                consumption: consumption(allocated: 4200, available: 0, percentage: 100),
                currency: .chf
            ) == "\(Decimal(4200).asAdaptiveCurrency(.chf)) dépensés · 100% utilisé"
        )
    }
}
