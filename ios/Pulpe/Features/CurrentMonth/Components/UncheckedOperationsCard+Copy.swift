import SwiftUI

// MARK: - Row Copy

extension UncheckedOperationsCard {
    /// What helps answer « is it passed? »: when the movement was noted, or that the line
    /// is a forecast of this month, with its rhythm.
    static func subtitle(for item: CurrentMonthStore.CheckableItem) -> String {
        switch item {
        // The date keeps its own case after the separator: German capitalizes nouns
        // ("Heute", "Montag") and English its weekdays.
        case .transaction(let transaction, _):
            AppLocale.string("Noté · \(transaction.transactionDate.relativeFormatted)")
        case .budgetLine(let line, _):
            AppLocale.string("Prévu ce mois · \(line.recurrence.label)")
        }
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
