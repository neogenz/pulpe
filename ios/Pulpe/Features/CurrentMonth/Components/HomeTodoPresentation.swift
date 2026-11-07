import Foundation

/// The words of the « À faire » rows. Pure, so the counts and the way names are joined are
/// pinned by tests rather than read off a screenshot.
enum HomeTodoPresentation {
    /// "4 mouvements à pointer" when only movements wait; "17 à pointer" once prévisions are in
    /// the count too, since a prévision is not a mouvement.
    static func toPointTitle(count: Int, includesForecasts: Bool) -> String {
        includesForecasts
            ? AppLocale.string("\(count) à pointer")
            : AppLocale.string("\(count) mouvements à pointer")
    }

    /// "Salaire, Loyer et 11 autres prévisions": what is waiting to be pointed on a first month.
    static func startSubtitle(names: [String]) -> String {
        switch names.count {
        case 0: ""
        case 1: names[0]
        case 2: AppLocale.string("\(names[0]) et \(names[1])")
        default: AppLocale.string("\(names[0]), \(names[1]) et \(names.count - 2) autres prévisions")
        }
    }

    /// "Courses et Sorties dépassent": the two biggest overruns, the rest counted.
    static func driftTitle(names: [String]) -> String {
        switch names.count {
        case 0: ""
        case 1: AppLocale.string("\(names[0]) dépasse")
        case 2: AppLocale.string("\(names[0]) et \(names[1]) dépassent")
        default: AppLocale.string("\(names[0]) et \(names.count - 1) autres dépassent")
        }
    }

    static func driftSubtitle(total: Decimal, currency: SupportedCurrency) -> String {
        AppLocale.string("\(total.asAmount(for: currency)) au-delà du prévu, à rattraper")
    }

    /// What the closed month leaves: its carry-over when it has one, else its verdict.
    static func recapSubtitle(_ recap: MonthRecap, currency: SupportedCurrency) -> String {
        if recap.carriedOver > 0 {
            let carried = recap.carriedOver.asAmount(for: currency)
            return AppLocale.string("\(carried) reportés sur \(Formatters.monthNameInText(for: recap.openedMonth))")
        }
        switch recap.outcome {
        case .saved:
            return AppLocale.string("Bien joué, tu as mis \(recap.endingBalance.asAdaptiveCurrency(currency)) de côté.")
        case .overspent:
            let over = (-recap.endingBalance).asAdaptiveCurrency(currency)
            return AppLocale.string("Ça arrive : \(over) de plus que prévu.")
        case .balanced:
            return AppLocale.string("Budget respecté.")
        }
    }
}

enum HomePresentation {
    /// "Jour 10 sur 31 · jusqu'au 24 novembre". `nil` while the period is unknown.
    static func periodCaption(progress: (day: Int, totalDays: Int)?, periodEnd: Date?) -> String? {
        guard let progress, let periodEnd else { return nil }
        return AppLocale.string(
            "Jour \(progress.day) sur \(progress.totalDays) · jusqu'au \(Formatters.dayMonthLabel(for: periodEnd))"
        )
    }
}
