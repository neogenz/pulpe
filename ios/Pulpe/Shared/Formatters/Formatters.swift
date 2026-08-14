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

    /// Maps a currency to the locale that punctuates **money**, and nothing else.
    ///
    /// Deliberately not derived from the interface language: `CHF 1234.5` renders
    /// `CHF 1'234.50` under fr_CH, de_CH and en_CH but `CHF 1234.50` under it_CH — the
    /// grouping separator disappears. A user who switches the app to Italian must keep
    /// seeing Swiss amounts written the Swiss way.
    ///
    /// Exhaustive switch — compiler enforces handling of every supported currency.
    static func locale(for currency: SupportedCurrency) -> Locale {
        switch currency {
        case .eur: Locale(identifier: "fr_FR")
        case .chf: Locale(identifier: "fr_CH")
        }
    }

    /// Compact chart-axis label. The thousands abbreviation is a word, so it follows the
    /// interface language the way CLDR writes it — `15 k` in French, `15K` in English and
    /// Italian, and none at all in German, which spells `15'000` — while digits, separators
    /// and grouping keep following the **currency** locale, like every other amount.
    static func compactAxisLabel(
        _ value: Double,
        currency: SupportedCurrency,
        language: SupportedLocale = AppLocale.current
    ) -> String {
        guard abs(value) >= 1000 else { return "\(Int(value))" }
        var components = Locale.Components(locale: locale(for: currency))
        components.languageComponents.languageCode = Locale.LanguageCode(language.rawValue)
        return value.formatted(
            .number.notation(.compactName)
                .precision(.fractionLength(0...1))
                .locale(Locale(components: components))
        )
        .replacingOccurrences(of: "'", with: swissGroupingSeparator)
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

    /// Thread-safe cache for amount-input formatters used to prefill editable
    /// amount fields. Locale follows the field's currency (CHF → fr_CH, EUR → fr_FR).
    nonisolated(unsafe) private static let amountInputFormatterCache = NSCache<NSString, NumberFormatter>()

    /// Returns a cached decimal NumberFormatter for prefilling amount input fields.
    /// Fraction digits stay flexible (0–2) so whole amounts render without forced decimals.
    static func amountInput(for currency: SupportedCurrency) -> NumberFormatter {
        let key = currency.rawValue as NSString
        if let cached = amountInputFormatterCache.object(forKey: key) {
            return cached
        }
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = locale(for: currency)
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        if currency == .chf {
            formatter.groupingSeparator = swissGroupingSeparator
        }
        amountInputFormatterCache.setObject(formatter, forKey: key)
        return formatter
    }

    static let percentage: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .percent
        return formatter
    }()

    /// Ordinal position: "1er"/"3e" in French, "1st"/"3rd" in English, "3." in German,
    /// "3º" in Italian. Never hand-build the suffix — the rules differ per language,
    /// and in several of them per gender too.
    static func ordinal(_ value: Int, locale: Locale = AppLocale.currentUILocale) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .ordinal
        formatter.locale = locale
        return formatter.string(from: NSNumber(value: value)) ?? String(value)
    }

    // MARK: - Month Name

    /// Bounds-checked month name from 1-based month number, capitalized.
    static func monthName(for month: Int) -> String {
        guard month >= 1, month <= 12 else { return "—" }
        return monthYear.monthSymbols[month - 1].capitalized
    }

    /// Short subtitle for each month. Copy, not data — it lives in the catalog like the
    /// rest of the interface, and is resolved here rather than in the view because the
    /// callers hand it to `Text` as an already-formatted string.
    static func monthSubtitle(
        for month: Int,
        isPositive: Bool,
        locale: Locale = AppLocale.currentUILocale
    ) -> String {
        guard let key = (isPositive ? positiveSubtitles : negativeSubtitles)[month] else { return "" }
        return AppLocale.string(key, locale: locale)
    }

    private static let positiveSubtitles: [Int: String.LocalizationValue] = [
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

    private static let negativeSubtitles: [Int: String.LocalizationValue] = [
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

    /// Date field templates, not patterns: `setLocalizedDateFormatFromTemplate` reorders
    /// the fields per language, so the same template yields "5 août", "5. August",
    /// "5 agosto" and "August 5" rather than four French word orders.
    private enum Template {
        static let monthYear = "MMMMyyyy"
        static let shortMonthYear = "MMMyyyy"
        static let dayMonth = "dMMMM"
        static let shortMonth = "MMM"
        static let month = "MMMM"
        static let weekday = "EEEE"
    }

    /// Thread-safe cache for date formatters, keyed by template **and** language.
    /// Keying on the template alone would hand back a formatter built for the previous
    /// language for the rest of the session — silently, and on every screen.
    nonisolated(unsafe) private static let dateFormatterCache = NSCache<NSString, DateFormatter>()

    /// Dates follow the interface **language**; only money follows the currency.
    /// `AppLocale.uiLocale` keeps the user's region, so a French-speaking Swiss user
    /// still gets Swiss conventions for everything the language does not decide.
    static func dateFormatter(
        _ template: String,
        in language: SupportedLocale = AppLocale.current
    ) -> DateFormatter {
        let key = "\(template)_\(language.rawValue)" as NSString
        if let cached = dateFormatterCache.object(forKey: key) {
            return cached
        }
        let formatter = DateFormatter()
        formatter.locale = AppLocale.uiLocale(for: language)
        formatter.setLocalizedDateFormatFromTemplate(template)
        dateFormatterCache.setObject(formatter, forKey: key)
        return formatter
    }

    static var monthYear: DateFormatter { dateFormatter(Template.monthYear) }

    static var shortMonthYear: DateFormatter { dateFormatter(Template.shortMonthYear) }

    static var dayMonth: DateFormatter { dateFormatter(Template.dayMonth) }

    static var shortMonth: DateFormatter { dateFormatter(Template.shortMonth) }

    static var month: DateFormatter { dateFormatter(Template.month) }

    static var weekday: DateFormatter { dateFormatter(Template.weekday) }

    /// "5 juillet", and the form each language declines on the first of the month.
    /// It is grammar, not locale data: French writes "1er août", Italian "1º agosto".
    /// German needs no special case — its template already yields "1. August" — and
    /// English writes "August 1" in running text, so neither is touched here.
    static func dayMonthLabel(for date: Date, in language: SupportedLocale = AppLocale.current) -> String {
        let dayAndMonth = dateFormatter(Template.dayMonth, in: language).string(from: date)
        guard Calendar.current.component(.day, from: date) == 1 else {
            return dayAndMonth
        }
        let monthName = dateFormatter(Template.month, in: language).string(from: date)
        switch language {
        case .fr: return "1er \(monthName)"
        case .it: return "1º \(monthName)"
        case .de, .en: return dayAndMonth
        }
    }
}
