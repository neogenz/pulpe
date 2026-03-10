import Foundation

/// Centralized formatters to avoid repeated instantiation
/// DateFormatter and NumberFormatter are expensive to create
enum Formatters {
    // MARK: - Currency

    /// Maps a currency code to its display locale
    static func locale(for currencyCode: String) -> Locale {
        switch currencyCode {
        case "EUR": Locale(identifier: "de_DE")
        default: Locale(identifier: "de_CH")
        }
    }

    /// Thread-safe cache for currency formatters
    nonisolated(unsafe) private static let formatterCache = NSCache<NSString, NumberFormatter>()

    /// Returns a cached NumberFormatter for the given currency code
    static func currencyFormatter(code: String, wholeNumber: Bool = false) -> NumberFormatter {
        let key = "\(code)_\(wholeNumber)" as NSString
        if let cached = formatterCache.object(forKey: key) {
            return cached
        }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        formatter.locale = locale(for: code)
        formatter.maximumFractionDigits = wholeNumber ? 0 : 2
        formatterCache.setObject(formatter, forKey: key)
        return formatter
    }

    static let chfCompact: NumberFormatter = currencyFormatter(code: "CHF")

    static let chfWholeNumber: NumberFormatter = currencyFormatter(code: "CHF", wholeNumber: true)

    static let amountInput: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        formatter.groupingSeparator = "'"
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
