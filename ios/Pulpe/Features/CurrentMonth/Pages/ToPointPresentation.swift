import Foundation

/// What each row of « À pointer » says under its name. Pure, so the overrun / remainder /
/// rhythm rules are tested rather than eyeballed.
enum ToPointPresentation {
    struct LineFact: Equatable {
        let text: String
        let isOverrun: Bool
    }

    /// A prévision's one fact: how far past its plan it ran, what is left of it once movements
    /// were counted in it, else its rhythm (a saving says so first).
    static func lineFact(
        for line: BudgetLine,
        consumption: BudgetFormulas.Consumption,
        currency: SupportedCurrency
    ) -> LineFact {
        if consumption.available < 0 {
            let over = (-consumption.available).asAmount(for: currency)
            return LineFact(text: AppLocale.string("\(over) au-delà du prévu"), isOverrun: true)
        }
        if consumption.allocated > 0 {
            let left = consumption.available.asAmount(for: currency)
            return LineFact(text: AppLocale.string("Reste \(left)"), isOverrun: false)
        }
        let rhythm = line.spreadGroupId != nil ? PendingWording.spread : line.recurrence.label
        let text = line.kind == .saving ? AppLocale.string("Épargne · \(rhythm)") : rhythm
        return LineFact(text: text, isOverrun: false)
    }

    /// "Courses · pointé à l'instant", "Hors prévision · Aujourd'hui": where the movement was
    /// counted, then when it was noted, or that it was just pointed.
    static func movementFact(for transaction: Transaction, lineName: String?, pointedNow: Bool) -> String {
        let place = lineName ?? PendingWording.unplanned
        let tail = pointedNow ? AppLocale.string("pointé à l'instant") : transaction.transactionDate.relativeFormatted
        return "\(place) · \(tail)"
    }
}
