import SwiftUI

// MARK: - Row Copy

extension UncheckedOperationsCard {
    /// What helps answer « is it passed? »: when the movement was noted, or that the line
    /// is a forecast of this month. The rhythm used to be spelled out here, after the
    /// separator; `recurrence(for:)` now carries it as a glyph, because the absence of the
    /// repeat arrows already says "this month only" — a second word after the separator
    /// only restated the sentence it follows.
    static func subtitle(for item: CurrentMonthStore.CheckableItem) -> String {
        switch item {
        // The date keeps its own case after the separator: German capitalizes nouns
        // ("Heute", "Montag") and English its weekdays.
        case .transaction(let transaction, _):
            AppLocale.string("Noté · \(transaction.transactionDate.relativeFormatted)")
        case .budgetLine:
            AppLocale.string("Prévu ce mois")
        }
    }

    /// The rhythm of a forecast, for the glyph beside the subtitle. A movement has none:
    /// it happened once, on the date its own subtitle already gives.
    static func recurrence(for item: CurrentMonthStore.CheckableItem) -> TransactionRecurrence? {
        switch item {
        case .transaction: nil
        case .budgetLine(let line, _): line.recurrence
        }
    }

    /// The name VoiceOver hears, carrying the rhythm the glyph can only half state:
    /// `repeat` marks a monthly forecast, a ponctuel one is marked by nothing at all,
    /// and nothing at all is what an unsighted reader would get.
    static func spokenName(for item: CurrentMonthStore.CheckableItem) -> String {
        guard let recurrence = recurrence(for: item) else { return item.name }
        return "\(item.name), \(recurrence.label)"
    }

    static func tagNames(for item: CurrentMonthStore.CheckableItem, namesById: [String: String]) -> [String] {
        switch item {
        case .transaction(let transaction, _):
            TagChips.names(for: transaction.tagIds, namesById: namesById)
        case .budgetLine(let line, _):
            TagChips.names(for: line.tagIds, namesById: namesById)
        }
    }

    static func amountText(for item: CurrentMonthStore.CheckableItem, in currency: SupportedCurrency) -> String {
        switch item {
        case .transaction(let transaction, _):
            transaction.amount.asSignedAmount(for: transaction.kind, in: currency)
        case .budgetLine(let line, _):
            line.amount.asSignedAmount(for: line.kind, in: currency)
        }
    }
}
