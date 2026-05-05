import Foundation

/// Centralized formatters to avoid repeated instantiation
/// DateFormatter and NumberFormatter are expensive to create
enum Formatters {
    // MARK: - Currency

    /// Canonical Swiss thousands separator (U+2019, RIGHT SINGLE QUOTATION MARK).
    /// Apple's `fr_CH` locale defaults to U+0027 (straight apostrophe), but the canonical
    /// Swiss typography — and what `Intl.NumberFormat('fr-CH', ...)` returns on the web —
    /// is U+2019. Aligned with frontend (PUL-125) so both clients render `1'235 CHF`.
    static let swissGroupingSeparator = "\u{2019}"

    /// Maps a currency to its display locale.
    /// Exhaustive switch — compiler enforces handling of every supported currency.
    static func locale(for currency: SupportedCurrency) -> Locale {
        switch currency {
        case .eur: Locale(identifier: "fr_FR")
        case .chf: Locale(identifier: "fr_CH")
        }
    }

    /// Thread-safe cache for currency formatters
    nonisolated(unsafe) private static let formatterCache = NSCache<NSString, NumberFormatter>()

    /// Returns a cached NumberFormatter for the given currency
    static func currencyFormatter(for currency: SupportedCurrency, wholeNumber: Bool = false) -> NumberFormatter {
        let key = "\(currency.rawValue)_\(wholeNumber)" as NSString
        if let cached = formatterCache.object(forKey: key) {
            return cached
        }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency.rawValue
        formatter.locale = locale(for: currency)
        formatter.maximumFractionDigits = wholeNumber ? 0 : 2
        if currency == .chf {
            formatter.groupingSeparator = swissGroupingSeparator
        }
        formatterCache.setObject(formatter, forKey: key)
        return formatter
    }

    /// Thread-safe cache for plain decimal formatters used by `Decimal.asAmount` /
    /// `Decimal.asCompactAmount`. Locale drives the decimal separator; for CHF we
    /// override the grouping separator to the canonical U+2019 apostrophe.
    nonisolated(unsafe) private static let amountFormatterCache = NSCache<NSString, NumberFormatter>()

    /// Returns a cached decimal NumberFormatter for displaying amounts without a currency symbol.
    /// `wholeNumber: true` rounds to integer (used by `asCompactAmount`).
    static func amountFormatter(for currency: SupportedCurrency, wholeNumber: Bool = false) -> NumberFormatter {
        let key = "\(currency.rawValue)_\(wholeNumber)" as NSString
        if let cached = amountFormatterCache.object(forKey: key) {
            return cached
        }
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = locale(for: currency)
        formatter.usesGroupingSeparator = true
        if wholeNumber {
            formatter.minimumFractionDigits = 0
            formatter.maximumFractionDigits = 0
            formatter.roundingMode = .halfUp
        } else {
            formatter.minimumFractionDigits = 2
            formatter.maximumFractionDigits = 2
        }
        if currency == .chf {
            formatter.groupingSeparator = swissGroupingSeparator
        }
        amountFormatterCache.setObject(formatter, forKey: key)
        return formatter
    }

    static let chfCompact: NumberFormatter = currencyFormatter(for: .chf)

    static let amountInput: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        formatter.groupingSeparator = swissGroupingSeparator
        return formatter
    }()

    static let percentage: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .percent
        return formatter
    }()

    // MARK: - Month Name

    /// Bounds-checked month name from 1-based month number, capitalized.
    static func monthName(for month: Int) -> String {
        guard month >= 1, month <= 12 else { return "—" }
        return monthYear.monthSymbols[month - 1].capitalized
    }

    /// Short subtitle for each month
    static func monthSubtitle(for month: Int, isPositive: Bool) -> String {
        (isPositive ? positiveSubtitles : negativeSubtitles)[month] ?? ""
    }

    private static let positiveSubtitles: [Int: String] = [
        1: "Nouveau départ, nouvelles ambitions",
        2: "Court mais décisif",
        3: "Le printemps des bonnes habitudes",
        4: "Tes finances prennent forme",
        5: "Le beau temps sur tes comptes",
        6: "Mi-parcours — tu tiens le cap",
        7: "Profite, ton budget suit",
        8: "L'été file, ton budget tient",
        9: "La rentrée, un nouveau souffle",
        10: "L'automne des bons choix",
        11: "Bientôt le bilan — tu gères",
        12: "Dernière ligne droite",
    ]

    private static let negativeSubtitles: [Int: String] = [
        1: "Janvier se rattrape vite",
        2: "Petit mois, petit ajustement",
        3: "Tu peux encore corriger le tir",
        4: "Rien d'irréversible — ajuste",
        5: "Un écart, pas une tendance",
        6: "Mi-parcours — tout se rééquilibre",
        7: "L'été coûte, c'est normal",
        8: "Ça arrive — septembre repart",
        9: "La rentrée remet les compteurs",
        10: "Encore le temps de corriger",
        11: "Presque fini — tiens bon",
        12: "On boucle, on ajuste",
    ]

    // MARK: - Dates

    static let monthYear: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.dateFormat = "MMMM yyyy"
        return formatter
    }()

    static let shortMonthYear: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.dateFormat = "MMM yyyy"
        return formatter
    }()

    static let dayMonth: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.dateFormat = "d MMMM"
        return formatter
    }()

    static let shortMonth: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.dateFormat = "MMM"
        return formatter
    }()

    static let month: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.dateFormat = "MMMM"
        return formatter
    }()

    static let weekday: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.dateFormat = "EEEE"
        return formatter
    }()
}
