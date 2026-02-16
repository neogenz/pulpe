import Foundation

/// Centralized formatters to avoid repeated instantiation
/// DateFormatter and NumberFormatter are expensive to create
enum Formatters {
    // MARK: - Currency

    static let chfCompact: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "CHF"
        f.locale = Locale(identifier: "de_CH")
        f.maximumFractionDigits = 2
        return f
    }()

    static let chfWholeNumber: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "CHF"
        f.locale = Locale(identifier: "de_CH")
        f.maximumFractionDigits = 0
        return f
    }()

    static let amountInput: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.minimumFractionDigits = 0
        f.maximumFractionDigits = 2
        f.groupingSeparator = "'"
        return f
    }()

    static let percentage: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .percent
        return f
    }()

    // MARK: - Dates

    static let monthYear: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.dateFormat = "MMMM yyyy"
        return f
    }()

    static let shortMonthYear: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.dateFormat = "MMM yyyy"
        return f
    }()

    static let dayMonth: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.dateFormat = "d MMMM"
        return f
    }()

    static let shortMonth: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.dateFormat = "MMM"
        return f
    }()

    static let month: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.dateFormat = "MMMM"
        return f
    }()
    
    static let weekday: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "fr_FR")
        f.dateFormat = "EEEE"
        return f
    }()

    // MARK: - ISO8601

    static let iso8601WithFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static let iso8601: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}
